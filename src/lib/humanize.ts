/**
 * Anti-« texte d'IA », adapté en français du humanizer du pack « instagram-agent-skill »
 * (Jake Schincariol, licence MIT) : nettoyage automatique de la typographie trahissante
 * (caractères invisibles, tirets longs) et repérage des tournures toutes faites, signalées
 * mais pas réécrites (il faut du jugement pour changer une phrase).
 */

/** Caractères invisibles qu'un clavier ne produit pas (espaces de largeur nulle, filigranes…). */
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿­᠎]|[\u{E0000}-\u{E007F}]/gu;

/** Nettoie un texte généré : invisibles supprimés, tirets longs remplacés, ponctuation recollée. */
export function cleanAiText(text: string): string {
  return (
    text
      .replace(INVISIBLE_RE, "")
      // Espaces insécables : de simples espaces (le réseau social gère l'affichage).
      .replace(/[   ]/g, " ")
      // Tiret long ou demi-cadratin entre deux mots : une virgule.
      .replace(/[ \t]*[—–][ \t]*(?=\S)/g, (_match, offset: number, whole: string) => {
        const before = whole.slice(0, offset);
        // En début de ligne (liste ou dialogue), un simple tiret.
        if (/(?:^|\n)[ \t]*$/.test(before)) return "- ";
        // Entre deux nombres (20–35 %), un trait d'union.
        if (/\d$/.test(before.trimEnd()) && /^\s*[—–]\s*\d/.test(whole.slice(offset))) return "-";
        return ", ";
      })
      .replace(/\s*[—–]\s*$/gm, ".")
      // Ponctuation doublée laissée par les remplacements.
      .replace(/,\s*([,.;!?])/g, "$1")
      .replace(/ {2,}/g, " ")
  );
}

/**
 * Légende proposée par l'IA : sans les guillemets qui l'entourent parfois, ni la ligne
 * de hashtags finale (les hashtags sont gérés à part).
 */
export function cleanAiCaption(text: string): string {
  let result = text.trim();
  const quotes = (result.match(/"/g) ?? []).length;
  if (result.startsWith('"') && (quotes % 2 === 1 || result.endsWith('"'))) result = result.slice(1);
  if (result.endsWith('"') && (result.match(/"/g) ?? []).length % 2 === 1) result = result.slice(0, -1);
  const lines = result.trimEnd().split("\n");
  while (lines.length > 1 && /^\s*(?:#[\p{L}\p{N}_]+[\s,]*)+$/u.test(lines.at(-1) ?? "")) lines.pop();
  return lines.join("\n").trim();
}

/** Applique `cleanAiText` à toutes les chaînes d'une réponse (objets et listes compris). */
export function cleanAiOutput<T>(value: T): T {
  if (typeof value === "string") return cleanAiText(value) as T;
  if (Array.isArray(value)) return value.map(cleanAiOutput) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanAiOutput(v)])) as T;
  }
  return value;
}

/** Tournures qui sentent le texte généré (ou le post « growth hacker ») en français. */
const AI_TELLS: { label: string; re: RegExp }[] = [
  { label: "« Ce n'est pas X, c'est Y »", re: /\b(?:ce n'est pas|ce n’est pas|c'est pas)\b[^.!?\n]{1,60}[,;:]\s*c'est\b/i },
  { label: "« Non seulement… mais aussi »", re: /\bnon seulement\b[^.!?\n]*\bmais (?:aussi|également)\b/i },
  { label: "Question-réponse mise en scène (« Le résultat ? »)", re: /(?:^|\n)\s*(?:le|la|les|mon|ma|mes|ton|ta|tes|son|sa|un|une)?\s*\p{L}+(?:\s\p{L}+)?\s?\?\s*(?:\n|$)/u },
  { label: "« Dans un monde où… »", re: /\bdans un monde où/i },
  { label: "« Plongeons » / « plonger dans »", re: /\bplong(?:eons|er|e) (?:dans|au cœur)\b/i },
  { label: "« Au cœur de »", re: /\bau cœur (?:de|du|des)\b/i },
  { label: "« Véritable » (en adjectif d'emphase)", re: /\bvéritables? (?:atout|révolution|game|levier|pépite|mine)\b/i },
  { label: "« Révolutionner / révolutionnaire »", re: /\brévolution(?:ner|naire|ne)\b/i },
  { label: "« Game changer »", re: /\bgame[- ]?changer\b/i },
  { label: "« Incontournable »", re: /\bincontournables?\b/i },
  { label: "« Booster »", re: /\bboost(?:er|e|ez)\b/i },
  { label: "« Levier » / « synergie »", re: /\b(?:levier|synergie)s?\b/i },
  { label: "« Sublimer »", re: /\bsublim(?:er|e|ez)\b/i },
  { label: "« N'hésite pas à »", re: /\bn['’]hésite(?:z)? pas à/i },
  { label: "« Que tu sois… ou… »", re: /\bque (?:tu sois|vous soyez)\b[^.!?\n]*\bou\b/i },
  { label: "« Dans ce post / cette vidéo, je vais »", re: /\bdans (?:ce post|cette vidéo|ce carrousel)\b[^.!?\n]{0,30}\b(?:je vais|on va|nous allons)\b/i },
  { label: "Appât réflexe (« Abonne-toi pour plus », « Tag quelqu'un »)", re: /\b(?:abonne[- ]toi pour (?:plus|ne rien rater)|tague? (?:quelqu'un|un ami|une amie)|double[- ]?tap|like si)\b/i },
  { label: "« Arrête de scroller »", re: /\barr[êe]te de scroller\b|\bstop (?:au )?scroll/i },
];

export type AiTell = { label: string; excerpt: string };

/** Tournures repérées dans un texte (pour les signaler, pas pour les réécrire). */
export function detectAiTells(text: string): AiTell[] {
  const found: AiTell[] = [];
  for (const tell of AI_TELLS) {
    const match = text.match(tell.re);
    if (match) found.push({ label: tell.label, excerpt: match[0].trim().slice(0, 60) });
  }
  // Liste à puces en emojis (3 lignes ou plus qui commencent par un emoji).
  const emojiLines = text.split("\n").filter((line) => /^\s*\p{Extended_Pictographic}/u.test(line)).length;
  if (emojiLines >= 3) found.push({ label: "Liste à puces en emojis", excerpt: `${emojiLines} lignes` });
  // Trois mots en capitales d'affilée.
  const shout = text.match(/\b\p{Lu}{3,}\b(?:\s+\b\p{Lu}{3,}\b){2,}/u);
  if (shout) found.push({ label: "Trois mots en capitales d'affilée", excerpt: shout[0].slice(0, 60) });
  if (/[—–]/.test(text)) found.push({ label: "Tiret long (—)", excerpt: "—" });
  return found;
}

/** Consignes anti-IA envoyées au modèle avec chaque rédaction. */
export const HUMAN_WRITING_RULES = [
  "# Écrire comme une personne",
  "- Phrases de longueurs variées, mots simples, contractions orales bienvenues sur les réseaux (« t'as », « y'a » seulement si le ton s'y prête).",
  "- Du concret : un chiffre vrai, une situation, un exemple, plutôt qu'un adjectif.",
  "- Pas de tiret long (—), pas de liste à puces en emojis, pas de mots en capitales pour crier.",
  "- Évite : « ce n'est pas X, c'est Y », « non seulement… mais aussi », les questions-réponses mises en scène (« Le résultat ? »), « dans un monde où », « plongeons dans », « au cœur de », « véritable atout », « révolutionner », « game changer », « incontournable », « booster », « levier », « synergie », « sublimer », « n'hésite pas à », « que tu sois… ou… ».",
  "- Pas d'appâts réflexes (« abonne-toi pour plus », « tague quelqu'un », « like si », « arrête de scroller ») ni d'introduction (« dans ce post, je vais… ») : commence directement par l'accroche.",
].join("\n");
