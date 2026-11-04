import "server-only";

import { parseBingResults, type SearchResult } from "@/lib/web";

import { renderHtml, WebError } from "./browser";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/** Recherche sur le web (Bing, résultats en français). */
export async function searchWeb(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 300);
  if (!q) throw new WebError("Recherche vide.");
  const url = `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=fr&cc=FR`;
  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9" },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (res.ok) html = await res.text();
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  let results = parseBingResults(html);
  // Page vide ou différente : on la charge dans le navigateur.
  if (!results.length) results = parseBingResults(await renderHtml(url, signal).catch(() => ""));
  return results;
}
