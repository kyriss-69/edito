/**
 * Accès à internet de l'assistant : adresses, résultats de recherche et texte
 * des pages, sans dépendre du navigateur (le chargement des pages est dans
 * `src/server/web/`).
 */

export type SearchResult = { title: string; url: string; snippet: string };

export type PageText = {
  url: string;
  title: string;
  text: string;
  /** Le texte a été coupé à la limite. */
  truncated: boolean;
  /** Liens internes trouvés sur la page (même site). */
  links: { url: string; label: string }[];
};

export const CAPTURE_DEVICES = [
  { id: "desktop", label: "Ordinateur" },
  { id: "mobile", label: "Téléphone" },
] as const;
export type CaptureDevice = (typeof CAPTURE_DEVICES)[number]["id"];

export const CAPTURE_MODES = [
  { id: "page", label: "Écran entier" },
  { id: "element", label: "Un bloc de la page" },
] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number]["id"];

/** Taille de la fenêtre simulée pour les captures (et densité de pixels). */
export const CAPTURE_VIEWPORTS: Record<CaptureDevice, { width: number; height: number; scale: number }> = {
  desktop: { width: 1440, height: 900, scale: 1.5 },
  mobile: { width: 390, height: 800, scale: 3 },
};

/**
 * « tamarque.fr/tarifs » → « https://tamarque.fr/tarifs ». Renvoie `null` si ce
 * n'est pas une adresse web (http ou https).
 */
export function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Adresse telle qu'affichée dans une barre d'adresse : « tamarque.fr/equipe ». */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
    return `${host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

/** Même site (en ignorant « www. »). */
export function sameSite(a: string, b: string): boolean {
  try {
    const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
    return host(a) === host(b);
  } catch {
    return false;
  }
}

/** Nettoie le texte d'une page (espaces, lignes vides) et le coupe à `max` caractères. */
export function cleanPageText(raw: string, max: number): { text: string; truncated: boolean } {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim());
  const kept: string[] = [];
  for (const line of lines) {
    // Pas plus d'une ligne vide d'affilée.
    if (!line && !kept.at(-1)) continue;
    kept.push(line);
  }
  const text = kept.join("\n").trim();
  if (text.length <= max) return { text, truncated: false };
  const cut = text.slice(0, max);
  const lastBreak = cut.lastIndexOf("\n");
  return { text: `${lastBreak > max * 0.8 ? cut.slice(0, lastBreak) : cut}\n[…]`, truncated: true };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/gi, (match, code: string) => {
    const known = ENTITIES[code.toLowerCase()];
    if (known) return known;
    if (code.startsWith("#x") || code.startsWith("#X")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return match;
  });
}

const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** Adresse réelle d'un lien de résultat Bing (`/ck/a?…&u=a1<adresse en base64>`). */
function bingTarget(href: string): string {
  const url = decodeEntities(href);
  const encoded = url.match(/[?&]u=a1([^&]+)/);
  if (!encoded) return url;
  try {
    const base64 = encoded[1].replace(/-/g, "+").replace(/_/g, "/");
    return new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
  } catch {
    return url;
  }
}

/** Lit une page de résultats de Bing. */
export function parseBingResults(html: string, limit = 8): SearchResult[] {
  const results: SearchResult[] = [];
  for (const block of html.split(/<li class="b_algo"/).slice(1)) {
    const link = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const url = bingTarget(link[1]);
    if (!/^https?:\/\//.test(url) || /^https?:\/\/(www\.)?bing\.com\//.test(url)) continue;
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    results.push({ title: stripTags(link[2]), url, snippet: snippet ? stripTags(snippet[1]) : "" });
    if (results.length >= limit) break;
  }
  return results;
}

/** Résultats de recherche présentés au modèle. */
export function formatSearchResults(query: string, results: SearchResult[]): string {
  if (!results.length) return `Aucun résultat pour « ${query} ».`;
  return [
    `Résultats pour « ${query} » :`,
    ...results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}${r.snippet ? `\n   ${r.snippet}` : ""}`),
  ].join("\n");
}
