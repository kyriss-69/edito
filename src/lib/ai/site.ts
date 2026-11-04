import { z } from "zod";

/**
 * Analyse du site de la marque : un résumé rédigé par l'assistant à partir des
 * pages du site, envoyé ensuite avec chaque demande (à côté du document de référence).
 */

/** Au-delà, le résumé prendrait trop de place dans le contexte du modèle. */
export const SITE_SUMMARY_MAX = 4_000;
/** Nombre de pages lues pendant l'analyse (accueil comprise). */
export const SITE_MAX_PAGES = 5;
/** Texte gardé par page lue. */
export const SITE_PAGE_CHARS = 4_000;

export const siteNotesSchema = z.object({
  url: z.string().max(500).default(""),
  summary: z.string().max(SITE_SUMMARY_MAX, `Résumé : ${SITE_SUMMARY_MAX} caractères maximum.`).default(""),
  pages: z.array(z.object({ url: z.string().max(2_000), title: z.string().max(300) })).max(20).default([]),
  /** Date de l'analyse (ms), `null` si le résumé n'a jamais été généré. */
  analyzedAt: z.number().nullable().default(null),
});
export type SiteNotes = z.infer<typeof siteNotesSchema>;

export const EMPTY_SITE_NOTES: SiteNotes = siteNotesSchema.parse({});

export function parseSiteNotes(raw: unknown): SiteNotes {
  const result = siteNotesSchema.safeParse(raw ?? {});
  return result.success ? result.data : EMPTY_SITE_NOTES;
}

/**
 * Choisit les pages à lire en plus de l'accueil : les liens du menu d'abord
 * (dans l'ordre de la page), sans pages légales, comptes ou fichiers.
 */
export function pickSitePages(links: readonly { url: string; label: string }[], home: string, max = SITE_MAX_PAGES - 1) {
  const skip =
    /(mentions|legal|l%C3%A9gal|cgu|cgv|conditions|confidentialit|privacy|cookie|login|connexion|signin|sign-in|signup|inscription|account|compte|panier|cart|checkout|wp-admin|feed|\.(pdf|jpe?g|png|webp|zip|xml)$)/i;
  const homePath = (() => {
    try {
      return new URL(home).pathname;
    } catch {
      return "/";
    }
  })();
  const seen = new Set<string>();
  const picked: string[] = [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link.url);
    } catch {
      continue;
    }
    url.hash = "";
    url.search = "";
    const key = url.toString().replace(/\/$/, "");
    if (url.pathname === homePath || seen.has(key) || skip.test(url.pathname)) continue;
    seen.add(key);
    picked.push(url.toString());
    if (picked.length >= max) break;
  }
  return picked;
}
