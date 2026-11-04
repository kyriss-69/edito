/**
 * Vérification d'une légende avant publication, adaptée en français du linter du pack
 * « instagram-agent-skill » (Jake Schincariol, licence MIT) : ce qui s'affiche avant
 * « plus », un seul appel à l'action, pas de lien mort, des hashtags qui servent à quelque chose.
 */
import { extractHashtags } from "./captions";
import { detectAiTells } from "./humanize";
import { PLATFORMS, type PlatformId } from "./platforms";

/** Caractères visibles avant « plus » sur Instagram. */
export const INSTAGRAM_VISIBLE_CHARS = 125;

/**
 * Règles par réseau, tirées des skills de `brand/skills/` (`commun/references/platform-limits.md`,
 * `platforms.md`, `linkedin-post-writer`, `x-algorithm.md`) : texte visible avant « plus »,
 * nombre de hashtags conseillé, liens qui coupent la portée, longueur idéale.
 */
export const PLATFORM_LINT_RULES: Record<
  PlatformId,
  {
    /** Caractères visibles avant « plus » (`null` : tout est visible). */
    visibleChars: number | null;
    /** Hashtags au-delà desquels on prévient. */
    hashtagsMax: number;
    /** Lien dans le texte : non cliquable (`dead`) ou pénalisé par l'algorithme (`reach`). */
    link: "dead" | "reach" | null;
    /** Longueur conseillée (caractères), si le skill en donne une. */
    idealLength?: [number, number];
  }
> = {
  instagram: { visibleChars: INSTAGRAM_VISIBLE_CHARS, hashtagsMax: 5, link: "dead" },
  tiktok: { visibleChars: 150, hashtagsMax: 5, link: "dead" },
  linkedin: { visibleChars: 210, hashtagsMax: 3, link: "reach", idealLength: [900, 2_000] },
  facebook: { visibleChars: 150, hashtagsMax: 2, link: "reach" },
  youtube: { visibleChars: 100, hashtagsMax: 15, link: null },
  x: { visibleChars: null, hashtagsMax: 2, link: "reach" },
};

const LINK_RE = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:fr|com|io|app)\/\S/i;

/** Hashtags qui ne décrivent rien. */
const EMPTY_HASHTAGS = new Set(["#fyp", "#foryou", "#foryoupage", "#pourtoi", "#explore", "#explorepage", "#viral", "#instagood", "#love", "#follow", "#like4like", "#trending"]);

/** Appels à l'action reconnus (un seul par légende). */
const ASKS: { label: string; re: RegExp }[] = [
  { label: "commenter", re: /\bcommente(?:z)?\b|\bdis-(?:le|nous|moi)\b|\ben commentaire\b/i },
  { label: "enregistrer", re: /\benregistre(?:z)?\b/i },
  { label: "partager", re: /\bpartage(?:z)?(?:-le)?\b|\benvoie(?:z)?-le\b/i },
  { label: "s'abonner", re: /\babonne(?:z)?-(?:toi|vous)\b/i },
  { label: "lien en bio", re: /\blien en bio\b|\bclique(?:z)? sur le lien\b/i },
  { label: "s'inscrire", re: /\brejoins\b|\brejoignez\b|\binscris-toi\b|\binscrivez-vous\b|\bdeviens\b|\bdevenez\b/i },
  { label: "écrire en DM", re: /\ben (?:DM|MP|message privé)\b|\bécris-(?:moi|nous)\b/i },
];

export type LintIssue = { level: "error" | "warning"; message: string };

export type CaptionLint = {
  /** Ce qui s'affiche avant « plus » (Instagram), sinon `null`. */
  visible: string | null;
  cut: boolean;
  issues: LintIssue[];
};

export function lintCaption(platform: PlatformId, caption: string, hashtags: string): CaptionLint {
  const text = caption.trim();
  const issues: LintIssue[] = [];
  if (!text) return { visible: null, cut: false, issues };

  const rules = PLATFORM_LINT_RULES[platform];
  const { label, captionLimit } = PLATFORMS[platform];
  const chars = [...text];
  const visible = rules.visibleChars === null ? null : chars.slice(0, rules.visibleChars).join("");
  const cut = rules.visibleChars !== null && chars.length > rules.visibleChars;

  const firstLine = text.split("\n")[0].trim();
  if (/^\p{Extended_Pictographic}/u.test(firstLine) || firstLine.startsWith("#")) {
    issues.push({ level: "warning", message: "La légende commence par un emoji ou un hashtag : commence par l'accroche." });
  }
  if (/^(?:bonjour|salut|hello|coucou|hey)\b/i.test(firstLine)) {
    issues.push({ level: "warning", message: "Pas de salutation en première ligne : c'est la place de l'accroche." });
  }
  if (rules.visibleChars !== null && [...firstLine].length > rules.visibleChars) {
    issues.push({ level: "warning", message: `L'accroche dépasse ${rules.visibleChars} caractères : elle est coupée par « plus » sur ${label}.` });
  }
  if (platform === "linkedin" && firstLine.endsWith("?")) {
    issues.push({ level: "warning", message: "Sur LinkedIn, ouvre sur une affirmation ou un chiffre plutôt qu'une question." });
  }
  if (LINK_RE.test(text)) {
    if (rules.link === "dead") {
      issues.push({ level: "error", message: `Lien dans la légende : il n'est pas cliquable sur ${label}. Écris « lien en bio ».` });
    } else if (rules.link === "reach") {
      issues.push({ level: "warning", message: `Lien dans le texte : ${label} réduit la portée des posts qui renvoient ailleurs. Mets-le en premier commentaire.` });
    }
  }
  const length = chars.length;
  if (length > captionLimit) {
    issues.push({ level: "error", message: `${length} caractères : ${label} en accepte ${captionLimit} au maximum.` });
  } else if (rules.idealLength && length < rules.idealLength[0]) {
    issues.push({ level: "warning", message: `Texte court pour ${label} (${length} caractères) : les posts de ${rules.idealLength[0]} à ${rules.idealLength[1]} caractères y portent plus loin.` });
  }

  // « lien en bio » ne fait que préciser où agir : « Rejoins la liste (lien en bio) » = un seul appel.
  const asks = [
    ...new Set(
      text.split(/(?<=[.!?…])\s+|\n+/).flatMap((sentence) => {
        const labels = ASKS.filter((ask) => ask.re.test(sentence)).map((ask) => ask.label);
        return labels.length > 1 ? labels.filter((label) => label !== "lien en bio") : labels;
      }),
    ),
  ];
  if (asks.length > 1) {
    issues.push({ level: "warning", message: `${asks.length} appels à l'action (${asks.join(", ")}) : garde-en un seul.` });
  }

  const emojis = text.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  if (emojis > Math.max(2, (chars.length / 100) * 4)) {
    issues.push({ level: "warning", message: `${emojis} emojis : c'est beaucoup, garde-les comme ponctuation.` });
  }

  const tags = [...new Set([...extractHashtags(text), ...extractHashtags(hashtags)].map((t) => t.toLowerCase()))];
  if (tags.length > rules.hashtagsMax) {
    issues.push({ level: "warning", message: `${tags.length} hashtags : ${rules.hashtagsMax} au plus conseillé sur ${label}.` });
  }
  const empty = tags.filter((tag) => EMPTY_HASHTAGS.has(tag.toLowerCase()));
  if (empty.length) {
    issues.push({ level: "warning", message: `Hashtags qui ne décrivent rien : ${empty.join(" ")}.` });
  }

  for (const tell of detectAiTells(text)) {
    issues.push({ level: "warning", message: `Tournure « IA » : ${tell.label}${tell.excerpt && tell.excerpt !== "—" ? ` (« ${tell.excerpt} »)` : ""}.` });
  }

  return { visible, cut, issues };
}
