import { revalidatePath } from "next/cache";

import { activeModel } from "@/lib/ai/settings";
import { pickSitePages, SITE_MAX_PAGES, SITE_PAGE_CHARS, type SiteNotes } from "@/lib/ai/site";
import { buildTaskMessages } from "@/lib/ai/tasks";
import { displayUrl, normalizeUrl, type PageText } from "@/lib/web";
import { getBrandContext } from "@/server/ai/context";
import type { AiPhase } from "@/server/ai/lmstudio";
import { errorMessage, ndjsonResponse, runTask, throttleProgress } from "@/server/ai/run-task";
import { getAiSettings, writeSiteNotes } from "@/server/settings";
import { readPage, WebError } from "@/server/web/browser";

const TIMEOUT_MS = 8 * 60 * 1000;

export type SiteStreamEvent =
  | { type: "step"; label: string }
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "result"; data: SiteNotes }
  | { type: "error"; message: string };

/**
 * Analyse le site de la marque : lit l'accueil et les pages principales, puis
 * l'assistant en rédige un résumé, enregistré et envoyé avec chaque demande.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? normalizeUrl(body.url) : null;
  if (!url) return Response.json({ error: "Adresse du site invalide." }, { status: 400 });

  const settings = getAiSettings();
  if (!activeModel(settings)) {
    return Response.json({ error: "Aucun modèle choisi : configure l'assistant dans Réglages." }, { status: 400 });
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);

  return ndjsonResponse<SiteStreamEvent>(async (send) => {
    try {
      send({ type: "step", label: `Lecture de ${displayUrl(url)}…` });
      const home = await readPage(url, { maxChars: SITE_PAGE_CHARS, signal });
      const pages: PageText[] = [home];
      for (const next of pickSitePages(home.links, home.url, SITE_MAX_PAGES - 1)) {
        if (signal.aborted) return;
        send({ type: "step", label: `Lecture de ${displayUrl(next)}…` });
        try {
          const page = await readPage(next, { maxChars: SITE_PAGE_CHARS, signal });
          if (page.text.length > 200) pages.push(page);
        } catch (error) {
          if (!(error instanceof WebError)) throw error;
          // Page illisible : on passe à la suivante.
        }
      }

      send({ type: "step", label: `Rédaction du résumé (${pages.length} page${pages.length > 1 ? "s" : ""} lue${pages.length > 1 ? "s" : ""})…` });
      const built = buildTaskMessages(
        "siteSummary",
        { url: home.url, pages: pages.map(({ url, title, text }) => ({ url, title, text })) },
        getBrandContext(settings),
      );
      if (!built.ok) throw new WebError(built.error);
      const { summary } = await runTask({
        task: "siteSummary",
        messages: built.messages,
        settings,
        signal,
        onProgress: throttleProgress((phase, chars) => send({ type: "progress", phase, chars })),
      });

      const notes: SiteNotes = {
        url: home.url,
        summary,
        pages: pages.map(({ url, title }) => ({ url, title: title.slice(0, 300) })),
        analyzedAt: Date.now(),
      };
      writeSiteNotes(notes);
      revalidatePath("/", "layout");
      send({ type: "result", data: notes });
    } catch (error) {
      const message = error instanceof WebError ? error.message : errorMessage(error, 8);
      if (message !== null) send({ type: "error", message });
    }
  });
}
