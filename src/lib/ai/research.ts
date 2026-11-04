import { z } from "zod";

import { displayUrl } from "@/lib/web";

import { buildSystemPrompt, describePost, platformTips, type BrandContext, type PostContext } from "./tasks";

/**
 * Recherches web d'un post (fiche d'un post › Recherches) : l'assistant cherche
 * et lit quelques pages sur le sujet, puis en garde des notes sourcées,
 * enregistrées sur le post (`posts.research`) et envoyées aux tâches de rédaction.
 */

export const RESEARCH_NOTES_MAX = 4_000;
/** Appels d'outils (recherches + pages lues) pour une recherche. */
export const RESEARCH_MAX_TOOL_CALLS = 6;
const MAX_SOURCES = 8;

const sourceSchema = z.object({ title: z.string().max(300).default(""), url: z.string().max(2_000) });
export type ResearchSource = z.output<typeof sourceSchema>;

export const postResearchSchema = z.object({
  notes: z.string().max(RESEARCH_NOTES_MAX + 200),
  sources: z.array(sourceSchema).max(MAX_SOURCES).default([]),
  at: z.number(),
});
export type PostResearch = z.output<typeof postResearchSchema>;

/** Lit les recherches stockées en JSON (texte vide ou abîmé = aucune). */
export function parseResearch(raw: string | null | undefined): PostResearch | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = postResearchSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.notes.trim() ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeResearch(research: PostResearch | null): string {
  return research && research.notes.trim() ? JSON.stringify(research) : "";
}

/** Garde les notes dans la limite, de préférence à la fin d'une ligne. */
export function clampNotes(notes: string): string {
  const text = notes.trim();
  if (text.length <= RESEARCH_NOTES_MAX) return text;
  const cut = text.slice(0, RESEARCH_NOTES_MAX);
  const line = cut.lastIndexOf("\n");
  return line > RESEARCH_NOTES_MAX * 0.7 ? cut.slice(0, line) : cut;
}

/** Sources sans doublon, pages lues d'abord, puis premiers résultats de recherche. */
export function pickSources(read: ResearchSource[], found: ResearchSource[]): ResearchSource[] {
  const seen = new Set<string>();
  const out: ResearchSource[] = [];
  for (const source of [...read, ...found]) {
    const key = source.url.replace(/[#?].*$/, "").replace(/\/$/, "");
    if (!source.url || seen.has(key)) continue;
    seen.add(key);
    out.push(source);
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

/** Texte envoyé aux tâches de rédaction (champ `research` du contexte d'un post). */
export function researchForPrompt(research: PostResearch | null): string {
  if (!research?.notes.trim()) return "";
  const sources = research.sources.map((s) => `- ${s.title || displayUrl(s.url)} (${s.url})`);
  return [research.notes.trim(), sources.length ? `Sources :\n${sources.join("\n")}` : ""].filter(Boolean).join("\n\n");
}

/** Consignes de l'agent de recherche. */
export function buildResearchMessages(
  post: PostContext,
  brand: BrandContext,
  { today, instruction = "" }: { today: Date; instruction?: string },
) {
  const system = [
    buildSystemPrompt(brand, null, { mode: "open" }),
    "",
    "# Ton rôle maintenant : documentaliste",
    `Nous sommes le ${today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`,
    "Avant que le post soit rédigé, tu cherches sur internet de quoi le rendre plus utile, plus précis et plus actuel : faits et chiffres sourcés, tendances récentes, questions que se pose le public, angles ou exemples qui marchent sur ces réseaux, mots-clés et hashtags employés.",
    "- Utilise web_search (1 à 3 recherches précises, en français, ajoute l'année pour l'actualité), puis read_page sur les 1 à 3 pages les plus utiles. Ne lis pas le site de la marque : on le connaît déjà.",
    "- N'écris rien que tu n'as pas lu dans une page ou vu dans les résultats. Chaque chiffre, date ou étude est suivi de sa source entre parenthèses (nom du site).",
    "- Termine par tes notes, sans rédiger le post : une liste à tirets, courte et dense (15 lignes maximum), regroupée sous ces intitulés quand ils ont du contenu : « Faits et chiffres », « Tendances et angles », « Mots-clés et hashtags ». Pas d'introduction ni de conclusion.",
  ].join("\n");
  const user = [
    describePost(post, { withCaption: false }),
    "",
    "# Codes des réseaux",
    platformTips(post.platforms ?? [], brand, ["tone"]),
    "",
    "# Demande",
    `Fais les recherches utiles pour ce post, puis donne tes notes.${instruction.trim() ? ` Ce que je veux trouver : ${instruction.trim()}` : ""}`,
  ].join("\n");
  return { system, user };
}
