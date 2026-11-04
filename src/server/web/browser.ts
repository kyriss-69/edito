import "server-only";

import type { Browser, BrowserContext, Locator, Page } from "playwright-core";

import {
  CAPTURE_VIEWPORTS,
  cleanPageText,
  sameSite,
  type CaptureDevice,
  type CaptureMode,
  type PageText,
} from "@/lib/web";

/** Erreur à afficher telle quelle (et à transmettre au modèle). */
export class WebError extends Error {}

export const NAVIGATION_TIMEOUT = 30_000;
/** Le navigateur est fermé après ce délai sans utilisation. */
const IDLE_MS = 3 * 60 * 1000;
export const USER_AGENT_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
export const USER_AGENT_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const globalForBrowser = globalThis as unknown as {
  editoBrowser?: Promise<Browser>;
  editoBrowserTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Chrome (ou Edge) installé sur l'ordinateur, piloté sans fenêtre. À défaut,
 * le Chromium de Playwright s'il a été installé (`npx playwright install chromium`).
 */
async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright-core");
  const attempts = [{ channel: "chrome" }, { channel: "msedge" }, {}];
  for (const options of attempts) {
    try {
      return await chromium.launch({ ...options, headless: true });
    } catch {
      // Essai suivant.
    }
  }
  throw new WebError(
    "Impossible d'ouvrir un navigateur pour aller sur internet. Installe Google Chrome, ou lance « npx playwright install chromium » dans le dossier du projet.",
  );
}

export async function getBrowser(): Promise<Browser> {
  let pending = globalForBrowser.editoBrowser;
  if (pending) {
    const browser = await pending.catch(() => null);
    if (browser?.isConnected()) return browser;
  }
  pending = launch();
  globalForBrowser.editoBrowser = pending;
  pending.catch(() => {
    if (globalForBrowser.editoBrowser === pending) globalForBrowser.editoBrowser = undefined;
  });
  return pending;
}

export function scheduleClose() {
  clearTimeout(globalForBrowser.editoBrowserTimer);
  globalForBrowser.editoBrowserTimer = setTimeout(() => {
    const pending = globalForBrowser.editoBrowser;
    globalForBrowser.editoBrowser = undefined;
    void pending?.then((browser) => browser.close()).catch(() => undefined);
  }, IDLE_MS);
}

async function withPage<T>(
  device: CaptureDevice,
  signal: AbortSignal | undefined,
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const browser = await getBrowser();
  const viewport = CAPTURE_VIEWPORTS[device];
  let context: BrowserContext | null = null;
  const abort = () => void context?.close().catch(() => undefined);
  signal?.addEventListener("abort", abort, { once: true });
  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      userAgent: device === "mobile" ? USER_AGENT_MOBILE : USER_AGENT_DESKTOP,
      locale: "fr-FR",
      // Les animations d'apparition sont désactivées ou raccourcies : la page est prête plus vite.
      reducedMotion: "reduce",
      colorScheme: "light",
    });
    const page = await context.newPage();
    return await run(page);
  } finally {
    signal?.removeEventListener("abort", abort);
    await context?.close().catch(() => undefined);
    scheduleClose();
  }
}

async function open(page: Page, url: string) {
  try {
    const response = await page.goto(url, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT });
    if (response && response.status() >= 400) {
      throw new WebError(`La page ${url} a répondu ${response.status()}.`);
    }
  } catch (error) {
    if (error instanceof WebError) throw error;
    // La page s'affiche parfois même si elle n'a pas fini de charger (vidéos, statistiques…).
    if (page.url() === "about:blank") {
      throw new WebError(`Impossible d'ouvrir ${url} (site injoignable ou trop lent).`);
    }
  }
  // Fait défiler toute la page pour déclencher les contenus qui apparaissent au défilement.
  await page
    .evaluate(async () => {
      const height = Math.min(document.body.scrollHeight, 20_000);
      for (let y = 0; y < height; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => undefined);
  await page.waitForTimeout(1_000);
  await hideOverlays(page);
}

/** Masque les bandeaux de cookies et fenêtres qui gâcheraient une capture. */
async function hideOverlays(page: Page) {
  await page
    .addStyleTag({
      content: [
        "#onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, #axeptio_overlay, #didomi-host,",
        ".cc-window, .cookie-banner, .cookies-banner, [id*='cookie-banner'], [class*='cookie-consent'],",
        "#tarteaucitronRoot, .qc-cmp2-container, #usercentrics-root { display: none !important; }",
      ].join(" "),
    })
    .catch(() => undefined);
}

/** Texte lisible d'une page (rendue comme dans un vrai navigateur). */
export async function readPage(url: string, { maxChars = 12_000, signal }: { maxChars?: number; signal?: AbortSignal } = {}): Promise<PageText> {
  return withPage("desktop", signal, async (page) => {
    await open(page, url);
    const raw = await page.evaluate(() => {
      const root = document.querySelector("main") ?? document.body;
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({ url: (a as HTMLAnchorElement).href, label: (a.textContent ?? "").trim().slice(0, 80) }))
        .filter((l) => l.url.startsWith("http"));
      const description = document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
      return { title: document.title, text: (root as HTMLElement).innerText, description, links };
    });
    const finalUrl = page.url();
    const { text, truncated } = cleanPageText(
      [raw.description && `Description : ${raw.description}`, raw.text].filter(Boolean).join("\n\n"),
      maxChars,
    );
    const seen = new Set<string>();
    const links = raw.links
      .map((l) => ({ ...l, url: l.url.split("#")[0] }))
      .filter((l) => sameSite(l.url, finalUrl) && l.url !== finalUrl && !seen.has(l.url) && seen.add(l.url))
      .slice(0, 40);
    return { url: finalUrl, title: raw.title.trim(), text, truncated, links };
  });
}

export type CaptureOptions = {
  url: string;
  device: CaptureDevice;
  mode: CaptureMode;
  /** Texte de la page à montrer : la capture défile jusqu'à lui (ou capture le bloc qui le contient). */
  focusText?: string;
  signal?: AbortSignal;
};

export type Capture = { png: Buffer; width: number; height: number; url: string; title: string };

/** Capture d'écran d'une page, ou d'un bloc de la page (carte, section…). */
export async function capturePage({ url, device, mode, focusText, signal }: CaptureOptions): Promise<Capture> {
  return withPage(device, signal, async (page) => {
    await open(page, url);
    const viewport = CAPTURE_VIEWPORTS[device];
    const text = focusText?.trim();
    const target = text ? page.getByText(text, { exact: false }).first() : null;
    if (target && !(await target.count())) {
      throw new WebError(`Le texte « ${text} » est introuvable sur ${url}.`);
    }

    if (mode === "element") {
      if (!target) throw new WebError("Indique un texte du bloc à capturer.");
      const { png, width, height } = await screenshotBlock(page, target, device);
      return {
        png,
        width,
        height,
        url: page.url(),
        title: await page.title(),
      };
    }

    if (target) {
      // Place le texte vers le haut de l'écran, comme quand on fait défiler la page.
      await target.evaluate((el) => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, Math.max(0, top - window.innerHeight * 0.2));
      });
      await page.waitForTimeout(500);
    }
    const png = await page.screenshot();
    return {
      png,
      width: viewport.width * viewport.scale,
      height: viewport.height * viewport.scale,
      url: page.url(),
      title: await page.title(),
    };
  });
}

/** Capture du bloc (carte, encadré…) qui contient l'élément visé. */
export async function screenshotBlock(page: Page, target: Locator, device: CaptureDevice) {
  const viewport = CAPTURE_VIEWPORTS[device];
  // Remonte du texte jusqu'au bloc qui l'entoure (carte avec fond, bordure ou ombre).
  const handle = await target.evaluateHandle((node) => {
    let el: Element | null = node as Element;
    let fallback: Element | null = null;
    while (el && el !== document.body) {
      const rect = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      const boxed =
        (css.backgroundColor !== "rgba(0, 0, 0, 0)" && css.backgroundColor !== "transparent") ||
        css.boxShadow !== "none" ||
        parseFloat(css.borderTopWidth) > 0;
      const bigEnough = rect.width >= 200 && rect.height >= 80;
      if (bigEnough && !fallback) fallback = el;
      if (bigEnough && boxed && rect.width <= window.innerWidth) return el;
      el = el.parentElement;
    }
    return fallback ?? (node as Element);
  });
  const element = handle.asElement();
  if (!element) throw new WebError("Bloc introuvable.");
  await element.scrollIntoViewIfNeeded().catch(() => undefined);
  await page.waitForTimeout(400);
  const box = await element.boundingBox();
  // Une petite marge autour du bloc, pour garder ses ombres et coins arrondis.
  const pad = 12;
  const clip = box
    ? {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: Math.min(box.width + pad * 2, viewport.width),
        height: Math.min(box.height + pad * 2, 2_400),
      }
    : undefined;
  const png = await page.screenshot({ clip });
  return {
    png,
    width: Math.round((clip?.width ?? viewport.width) * viewport.scale),
    height: Math.round((clip?.height ?? viewport.height) * viewport.scale),
  };
}

/** Charge une page de résultats de recherche (quand une simple requête est refusée). */
export async function renderHtml(url: string, signal?: AbortSignal): Promise<string> {
  return withPage("desktop", signal, async (page) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT });
    return page.content();
  });
}
