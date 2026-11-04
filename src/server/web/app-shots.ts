import "server-only";

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { BrowserContext, Page } from "playwright-core";

import { getDb } from "@/db";
import { libraryAssets } from "@/db/schema";
import {
  APP_SHOTS_CATEGORY,
  appShotFileName,
  appShotNotes,
  type AppShot,
  type AppShotsConfig,
  type AppShotsEvent,
} from "@/lib/app-shots";
import { UPLOADS_DIR } from "@/lib/paths";
import { CAPTURE_VIEWPORTS } from "@/lib/web";
import { mediaPath } from "@/server/media-storage";
import { getActiveWorkspace } from "@/server/workspace";

import {
  NAVIGATION_TIMEOUT,
  USER_AGENT_DESKTOP,
  USER_AGENT_MOBILE,
  WebError,
  getBrowser,
  scheduleClose,
  screenshotBlock,
} from "./browser";

/** L'app répond-elle ? */
async function appIsRunning(baseUrl: string) {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(1_200);
}

/**
 * Navigation interne de l'app (Nuxt) : un rechargement complet perd la session,
 * on passe donc par le routeur de l'app.
 */
async function goTo(page: Page, baseUrl: string, path: string) {
  const routed = await page
    .evaluate((target) => {
      const app = (document.querySelector("#__nuxt") as unknown as { __vue_app__?: { config: { globalProperties: { $router?: { push: (p: string) => Promise<unknown> } } } } } | null)?.__vue_app__;
      const router = app?.config.globalProperties.$router;
      if (!router) return false;
      void router.push(target);
      return true;
    }, path)
    .catch(() => false);
  if (!routed) await page.goto(baseUrl + path, { waitUntil: "load", timeout: NAVIGATION_TIMEOUT });
  await page.waitForURL((url) => url.pathname.startsWith(path.split("?")[0]) || path === "/", { timeout: 15_000 }).catch(() => undefined);
  await settle(page);
}

async function login(page: Page, config: AppShotsConfig, role: string) {
  const account = config.accounts[role];
  if (!account) throw new WebError(`Compte « ${role} » absent de appShots.accounts.`);
  await page.goto(`${config.baseUrl}${config.loginPath}`, { waitUntil: "networkidle", timeout: NAVIGATION_TIMEOUT });
  // Laisse l'app s'hydrater, sinon les champs remplis sont vidés.
  await page.waitForTimeout(1_500);
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', account.password);
  await page.press('input[type="password"]', "Enter");
  try {
    await page.waitForURL((url) => url.pathname.startsWith(config.loggedInUrl), { timeout: 20_000 });
  } catch {
    throw new WebError(
      `Connexion impossible avec le compte ${account.email}. Vérifie qu'il existe dans l'app.`,
    );
  }
  await settle(page);
}

/** Masque les outils de développement et charge les contenus qui apparaissent au défilement. */
async function prepare(page: Page) {
  await page
    .addStyleTag({ content: "[id^='nuxt-devtools'], .nuxt-devtools-frame, nuxt-devtools, [data-v-inspector] { display: none !important; }" })
    .catch(() => undefined);
  await page
    .evaluate(async () => {
      const height = Math.min(document.body.scrollHeight, 12_000);
      for (let y = 0; y < height; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function shoot(page: Page, baseUrl: string, shot: AppShot): Promise<Buffer> {
  await goTo(page, baseUrl, shot.path);
  if (shot.follow) {
    const { prefix, text } = shot.follow;
    const href = await page.evaluate(
      ({ prefix, text }) =>
        Array.from(document.querySelectorAll("a[href]"))
          .find((a) => {
            const value = a.getAttribute("href") ?? "";
            return value.startsWith(prefix) && value.length > prefix.length && (!text || (a.textContent ?? "").includes(text));
          })
          ?.getAttribute("href") ?? null,
      { prefix, text },
    );
    if (!href) throw new WebError(`Aucun lien vers ${prefix}${text ? ` (« ${text} »)` : ""} sur ${shot.path}.`);
    await goTo(page, baseUrl, href);
  }
  await prepare(page);
  if (!shot.block) return page.screenshot();
  const target = page.getByText(shot.block, { exact: false }).first();
  if (!(await target.count())) throw new WebError(`Le bloc « ${shot.block} » est introuvable.`);
  return (await screenshotBlock(page, target, shot.device)).png;
}

/** Range la capture dans la médiathèque, en remplaçant la précédente du même écran. */
function save(shot: AppShot, note: string, png: Buffer): number {
  const db = getDb();
  const originalName = appShotFileName(shot.key);
  const existing = db
    .select()
    .from(libraryAssets)
    .where(and(eq(libraryAssets.category, APP_SHOTS_CATEGORY), eq(libraryAssets.originalName, originalName)))
    .get();
  const fileName = `${randomUUID()}.png`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.writeFileSync(mediaPath(fileName), png);
  const values = {
    fileName,
    originalName,
    mimeType: "image/png",
    size: png.length,
    title: shot.title,
    category: APP_SHOTS_CATEGORY,
    notes: appShotNotes(shot, note),
  };
  if (existing) {
    db.update(libraryAssets).set({ ...values, updatedAt: new Date() }).where(eq(libraryAssets.id, existing.id)).run();
    fs.promises.unlink(mediaPath(existing.fileName)).catch(() => undefined);
    return existing.id;
  }
  return db.insert(libraryAssets).values(values).returning({ id: libraryAssets.id }).get().id;
}

/** Capture tous les écrans de l'app (ou ceux demandés) et les range dans la médiathèque. */
export async function captureAppShots(
  send: (event: AppShotsEvent) => void,
  { keys, signal }: { keys?: string[]; signal?: AbortSignal } = {},
) {
  const config = getActiveWorkspace().appShots;
  if (!config) {
    send({ type: "error", message: "Aucune app à capturer : ajoute « appShots » à cet espace dans workspaces.json." });
    return;
  }
  const shots = keys?.length ? config.shots.filter((s) => keys.includes(s.key)) : config.shots;
  if (!(await appIsRunning(config.baseUrl))) {
    send({
      type: "error",
      message: `${config.appName} ne répond pas sur ${config.baseUrl}.${config.startHint ? ` Lance-la (${config.startHint})` : " Lance-la"} et réessaie.`,
    });
    return;
  }
  send({ type: "start", total: shots.length });

  // Une session par compte et par type d'écran.
  const groups = new Map<string, AppShot[]>();
  for (const shot of shots) {
    const id = `${shot.role}:${shot.device}`;
    groups.set(id, [...(groups.get(id) ?? []), shot]);
  }

  const browser = await getBrowser();
  let saved = 0;
  let failed = 0;
  try {
    for (const group of groups.values()) {
      const { role, device } = group[0];
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
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        let loginError: string | null = null;
        if (role !== "public") {
          try {
            await login(page, config, role);
          } catch (error) {
            loginError = error instanceof Error ? error.message : "Connexion impossible.";
          }
        }
        for (const shot of group) {
          if (signal?.aborted) return;
          const index = shots.indexOf(shot);
          try {
            if (loginError) throw new WebError(loginError);
            const png = await shoot(page, config.baseUrl, shot);
            const assetId = save(shot, config.notes, png);
            saved++;
            send({ type: "shot", index, key: shot.key, title: shot.title, ok: true, assetId });
          } catch (error) {
            failed++;
            const message = error instanceof WebError ? error.message : "Capture impossible.";
            send({ type: "shot", index, key: shot.key, title: shot.title, ok: false, error: message });
          }
        }
      } finally {
        signal?.removeEventListener("abort", abort);
        await context?.close().catch(() => undefined);
      }
    }
  } finally {
    scheduleClose();
  }
  send({ type: "done", saved, failed });
}
