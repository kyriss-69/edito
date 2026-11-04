import { PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/lib/platforms";

/**
 * Skills par réseau : guides publiés sur GitHub, copiés sans modification dans
 * `brand/skills/` (sources et licences dans `brand/skills/README.md`). Pour chaque
 * réseau et chaque usage, la liste des fichiers (ou d'une section `## …`) envoyés
 * au modèle, nettoyés et coupés à un budget de caractères.
 */
export type SkillPurpose = "caption" | "carousel";

export type SkillSource = {
  /** Chemin relatif à `brand/skills/`. */
  path: string;
  /** Titre exact d'une section `## …` à extraire (sinon tout le fichier). */
  section?: string;
};

export const SKILLS_FOLDER = "brand/skills";

const carouselFrameworks: SkillSource = { path: "commun/references/carousel-frameworks.md" };

export const PLATFORM_SKILL_FILES: Record<PlatformId, Record<SkillPurpose, SkillSource[]>> = {
  instagram: {
    caption: [{ path: "instagram/ig-caption/SKILL.md" }],
    carousel: [{ path: "instagram/ig-carousel/SKILL.md" }],
  },
  tiktok: {
    caption: [
      { path: "commun/references/platforms.md", section: "TikTok" },
      { path: "tiktok/short-form-video.md" },
    ],
    carousel: [{ path: "commun/references/platforms.md", section: "TikTok" }, carouselFrameworks],
  },
  linkedin: {
    caption: [{ path: "linkedin/linkedin-post-writer/SKILL.md" }],
    carousel: [{ path: "commun/references/platforms.md", section: "LinkedIn" }, carouselFrameworks],
  },
  facebook: {
    caption: [
      { path: "commun/references/platforms.md", section: "Facebook" },
      { path: "commun/references/platform-limits.md", section: "Facebook" },
    ],
    carousel: [{ path: "commun/references/platforms.md", section: "Facebook" }, carouselFrameworks],
  },
  youtube: {
    caption: [
      { path: "commun/references/platform-limits.md", section: "YouTube" },
      { path: "youtube/packaging-youtube-thumbnails/references/packaging-rubric.md" },
    ],
    carousel: [carouselFrameworks],
  },
  x: {
    caption: [
      { path: "commun/references/platforms.md", section: "Twitter/X" },
      { path: "x/x-algorithm.md" },
    ],
    carousel: [{ path: "commun/references/platforms.md", section: "Twitter/X" }, carouselFrameworks],
  },
};

/** Budget d'un réseau seul ; partagé entre les réseaux quand il y en a plusieurs. */
export const PLATFORM_SKILL_MAX_CHARS = 8_000;
const MIN_SHARE = 2_000;

/** Textes déjà lus : réseau → usage → guide nettoyé (complet). */
export type PlatformSkills = Partial<Record<PlatformId, Partial<Record<SkillPurpose, string>>>>;

/** État d'un réseau pour Marque › Identité. */
export type PlatformSkillInfo = { platform: PlatformId; files: string[]; missing: string[]; chars: number };

/** Garde une section `## titre` (jusqu'à la suivante de même niveau). */
export function extractSection(text: string, title: string): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start < 0) return "";
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

/**
 * Nettoie un guide : sans en-tête YAML, commentaires ni blocs de code shell
 * (ils lancent des scripts qui n'existent pas ici).
 */
export function prepareSkill(raw: string, section?: string): string {
  let text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  text = text.replace(/^---\n[\s\S]*?\n---\n/, "");
  if (section) text = extractSection(text, section);
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```(\w*)\n[\s\S]*?```/g, (block, lang: string) =>
      /^(bash|sh|shell|zsh|python|py)$/.test(lang) || /\b(python3?|npm|npx|pip)\b/.test(block) ? "" : block,
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Coupe à la limite, de préférence entre deux paragraphes. */
export function truncateSkill(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const paragraph = cut.lastIndexOf("\n\n");
  return `${paragraph > max * 0.7 ? cut.slice(0, paragraph) : cut}\n\n[… suite du guide non transmise …]`;
}

/**
 * Section du prompt avec le guide de chaque réseau demandé, budget partagé.
 * Vide si aucun guide n'a été trouvé.
 */
export function platformSkillsPrompt(
  platforms: readonly PlatformId[],
  skills: PlatformSkills | null | undefined,
  purpose: SkillPurpose,
  budget = PLATFORM_SKILL_MAX_CHARS,
): string {
  const list = (platforms.length ? platforms : PLATFORM_IDS).filter((p) => skills?.[p]?.[purpose]?.trim());
  if (!list.length) return "";
  const share = Math.max(MIN_SHARE, Math.floor(budget / list.length));
  const parts = [
    "# Guides des réseaux (skills d'experts, en anglais)",
    "Applique leurs conseils (structure, accroche, longueur, appel à l'action, hashtags), mais écris toujours en français, avec le ton, le tutoiement ou vouvoiement et les règles de la marque, qui restent prioritaires. Ignore ce qui parle d'outils, de scripts ou de commandes : tu n'en as pas.",
  ];
  for (const p of list) {
    parts.push("", `## Guide ${PLATFORMS[p].label}`, '"""', truncateSkill(skills![p]![purpose]!.trim(), share), '"""');
  }
  return parts.join("\n");
}
