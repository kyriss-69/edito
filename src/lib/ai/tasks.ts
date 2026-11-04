import { z } from "zod";

import { normalizeHashtags } from "@/lib/captions";
import { FORMATS, PLATFORM_IDS, PLATFORMS, formatLabel, type PlatformId } from "@/lib/platforms";

import { describeBrandKit, type BrandKit } from "@/lib/brand";

import { MAX_SLIDES, SLIDE_LIMITS, slideRole } from "@/lib/carousel";

import { MAX_ANALYSIS_IMAGES } from "./media";
import { SITE_MAX_PAGES, SITE_PAGE_CHARS, SITE_SUMMARY_MAX } from "./site";
import { extractJson } from "./parse";

import { cleanAiCaption, cleanAiOutput, HUMAN_WRITING_RULES } from "@/lib/humanize";

import { hookGuide } from "./hooks";
import { platformSkillsPrompt, type PlatformSkills } from "./platform-skills";
import { PROFILE_RUBRIC, PROFILE_RUBRIC_TOTAL } from "./profile-rubric";
import { describeVoice, resolveVoice, type PlatformVoice } from "./platform-voice";
import type { AiSettings, BrandBrief } from "./settings";

/**
 * Brief de marque (réglages de l'assistant) + charte graphique de la bibliothèque
 * + document de référence `brand/MARQUE.md`.
 */
export type BrandContext = BrandBrief & {
  kit?: BrandKit | null;
  doc?: string | null;
  /** Guides de l'espace (leçons, règles de vérification), voir `WORKSPACES`. */
  guides?: string | null;
  /** Résumé du site de la marque (Marque › Identité). */
  site?: { url: string; summary: string; analyzedAt: number | null } | null;
  /** Consignes par réseau réglées par la marque (sinon valeurs par défaut). */
  voices?: AiSettings["voices"];
  /** Guides par réseau (`brand/skills/`), voir `platform-skills.ts`. */
  skills?: PlatformSkills | null;
};

/**
 * Liberté de rédaction d'un post : `open` autorise les connaissances générales sur le sujet
 * (faits sur la marque toujours tirés du document de référence), `strict` s'en tient à la marque.
 */
export const AI_MODES = [
  { id: "open", label: "Ouverte", hint: "Peut parler du sujet au-delà de la marque (conseils, tendances, métier)." },
  { id: "strict", label: "Stricte", hint: "S'en tient à la marque et à son document de référence." },
] as const;
export type AiMode = (typeof AI_MODES)[number]["id"];

/** Ajoute une section (précédée d'une ligne vide) si elle n'est pas vide. */
const section = (text: string) => (text ? ["", text] : []);

/** Mention ajoutée aux notes des posts créés depuis le générateur d'idées. */
export const GENERATED_IDEA_MARK = "(idée générée par l'assistant)";

/** Partie d'un message : texte ou image (format OpenAI, image encodée en data URL). */
export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

/* ------------------------------------------------------------------ */
/* Entrées                                                            */
/* ------------------------------------------------------------------ */

const platformsSchema = z.array(z.enum(PLATFORM_IDS));

export const postContextSchema = z.object({
  title: z.string().max(200),
  notes: z.string().max(5_000).default(""),
  format: z.string().max(40).default("image"),
  pillar: z.string().max(80).nullable().default(null),
  campaign: z.string().max(80).nullable().default(null),
  platforms: platformsSchema.default([]),
  cta: z.string().max(500).default(""),
  link: z.string().max(2_000).default(""),
  caption: z.string().max(10_000).default(""),
  hashtags: z.string().max(5_000).default(""),
  aiMode: z.enum(["open", "strict"]).default("open"),
  /** Notes de recherche web sourcées (`researchForPrompt`, `research.ts`). */
  research: z.string().max(6_000).default(""),
});
export type PostContext = z.input<typeof postContextSchema>;

/** Image envoyée au modèle : photo ou image extraite d'une vidéo, réduite côté navigateur. */
export const analysisImageSchema = z.object({
  /** Ce que représente l'image, ex. « Média 2 — vidéo de 0:15, image à 0:04 ». */
  label: z.string().trim().max(200),
  dataUrl: z
    .string()
    .max(4_000_000, "Image trop lourde")
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Image invalide"),
});
export type AnalysisImage = z.infer<typeof analysisImageSchema>;

export const REWRITE_MODES = [
  { id: "shorter", label: "Raccourcir" },
  { id: "fun", label: "Ton plus fun" },
  { id: "pro", label: "Ton plus pro" },
  { id: "emojis", label: "Ajouter des emojis" },
  { id: "cta", label: "Ajouter un appel à l'action" },
  { id: "fix", label: "Corriger les fautes" },
  { id: "custom", label: "Consigne libre…" },
] as const;
export type RewriteMode = (typeof REWRITE_MODES)[number]["id"];

const REWRITE_INSTRUCTIONS: Record<Exclude<RewriteMode, "custom">, string> = {
  shorter:
    "Raccourcis cette légende d'environ moitié, en gardant l'accroche et le message principal.",
  fun: "Réécris cette légende avec un ton plus fun et léger, avec une pointe d'humour, sans perdre le message.",
  pro: "Réécris cette légende avec un ton plus professionnel et crédible, tout en restant accessible et humain.",
  emojis:
    "Ajoute quelques emojis pertinents à cette légende, sans en abuser et sans changer le texte.",
  cta: "Ajoute à la fin de cette légende un appel à l'action clair et engageant (ou améliore celui qui existe).",
  fix: "Corrige l'orthographe, la grammaire, la typographie et la ponctuation de cette légende, sans changer son style ni son contenu.",
};

/** Carrousel du Studio : sujet, description du post et texte actuel des slides. */
const carouselContextSchema = {
  title: z.string().max(200).default(""),
  description: z
    .string()
    .trim()
    .min(1, "Décris d'abord le post : l'IA s'en sert pour rédiger les slides.")
    .max(5_000),
  slides: z
    .array(
      z.object({
        title: z.string().max(SLIDE_LIMITS.title).default(""),
        body: z.string().max(SLIDE_LIMITS.body).default(""),
        /** Image posée sur la slide (ex. « capture d'écran de tamarque.fr dans un téléphone »). */
        visual: z.string().max(300).default(""),
        /** Place du texte sur cette slide quand elle diffère (image qui prend de la place). */
        capacity: z
          .object({ title: z.number().int().min(0).max(1_000), body: z.number().int().min(0).max(5_000) })
          .nullable()
          .default(null),
      }),
    )
    .min(1)
    .max(MAX_SLIDES),
  /** Place disponible dans la zone de texte du mockup, en caractères. */
  capacity: z
    .object({ title: z.number().int().min(0).max(1_000), body: z.number().int().min(0).max(5_000) })
    .nullable()
    .default(null),
  /** Écrans de l'app (médiathèque, catégorie « app ») que l'IA peut poser sur une slide. */
  screens: z
    .array(z.object({ id: z.number().int().positive(), title: z.string().max(120), description: z.string().max(500) }))
    .max(80)
    .default([]),
  /** Place du texte sur une slide qui porte un écran (l'image prend le bas de la slide). */
  screenCapacity: z
    .object({ title: z.number().int().min(0).max(1_000), body: z.number().int().min(0).max(5_000) })
    .nullable()
    .default(null),
  /** Réseau pour lequel écrire les slides (sinon un texte valable partout). */
  platform: z.enum(PLATFORM_IDS).nullable().default(null),
  /** Mise en page du Studio : kicker et note de source par slide, mots du titre en couleur d'accent. */
  look: z
    .object({ kickers: z.boolean().default(false), accent: z.boolean().default(false) })
    .prefault({}),
  instruction: z.string().max(1_000).default(""),
};

const inputSchemas = {
  captions: z.object({
    post: postContextSchema,
    instruction: z.string().max(1_000).default(""),
  }),
  rewrite: z.object({
    post: postContextSchema,
    caption: z.string().min(1, "La légende est vide").max(10_000),
    mode: z.enum(REWRITE_MODES.map((m) => m.id) as [RewriteMode, ...RewriteMode[]]),
    instruction: z.string().max(1_000).default(""),
  }),
  adapt: z.object({
    post: postContextSchema,
    caption: z.string().min(1, "La légende est vide").max(10_000),
    platform: z.enum(PLATFORM_IDS),
  }),
  hashtags: z.object({
    post: postContextSchema,
    count: z.number().int().min(3).max(30).default(15),
  }),
  ideas: z.object({
    pillar: z.string().max(80).nullable().default(null),
    platforms: platformsSchema.default([]),
    count: z.number().int().min(1).max(15).default(5),
    instruction: z.string().max(1_000).default(""),
    existingTitles: z.array(z.string().max(200)).max(100).default([]),
  }),
  extractIdeas: z.object({
    text: z.string().trim().min(1, "Le message est vide").max(20_000),
    platforms: platformsSchema.default([]),
  }),
  visualBrief: z.object({
    post: postContextSchema,
    instruction: z.string().max(1_000).default(""),
  }),
  carouselSlides: z.object(carouselContextSchema),
  carouselSlide: z
    .object({ ...carouselContextSchema, index: z.number().int().min(0) })
    .refine((v) => v.index < v.slides.length, "Slide inconnue"),
  mediaAnalysis: z.object({
    post: postContextSchema,
    images: z
      .array(analysisImageSchema)
      .min(1, "Aucun média à analyser")
      .max(MAX_ANALYSIS_IMAGES, `${MAX_ANALYSIS_IMAGES} images maximum`),
    /** Le post contient au moins une vidéo (dont on n'envoie que quelques images). */
    hasVideo: z.boolean().default(false),
    count: z.number().int().min(3).max(30).default(15),
    instruction: z.string().max(1_000).default(""),
  }),
  siteSummary: z.object({
    url: z.string().max(500),
    pages: z
      .array(
        z.object({
          url: z.string().max(2_000),
          title: z.string().max(300).default(""),
          text: z.string().max(SITE_PAGE_CHARS + 500),
        }),
      )
      .min(1, "Aucune page lue sur le site")
      .max(SITE_MAX_PAGES),
  }),
  bio: z.object({
    platform: z.enum(PLATFORM_IDS),
    handle: z.string().max(100).default(""),
    currentBio: z.string().max(1_000).default(""),
    bioLink: z.string().max(500).default(""),
    instruction: z.string().max(1_000).default(""),
  }),
  profileAudit: z.object({
    handle: z.string().max(100).default(""),
    /** Nom affiché en gras sur le profil (30 caractères). */
    nameField: z.string().max(100).default(""),
    bio: z.string().max(1_000).default(""),
    bioLink: z.string().max(500).default(""),
    highlights: z.string().max(1_000).default(""),
    pinned: z.string().max(1_000).default(""),
    /** Ce que l'utilisateur sait du reste : grille, stories, compte pro… */
    notes: z.string().max(2_000).default(""),
    /** Faits calculés par l'app (dernier post publié, posts prévus). */
    activity: z.string().max(500).default(""),
  }),
};

export type AiTaskId = keyof typeof inputSchemas;
export type AiTaskInput<T extends AiTaskId> = z.input<(typeof inputSchemas)[T]>;

/* ------------------------------------------------------------------ */
/* Sorties                                                            */
/* ------------------------------------------------------------------ */

const text = z.string().trim().min(1);
const formatIds = FORMATS.map((f) => f.id) as string[];

const slideText = z.object({
  kicker: z.string().trim().optional(),
  title: z.string().trim().default(""),
  body: z.string().trim().default(""),
  source: z.string().trim().optional(),
  /** Écran de l'app choisi pour la slide (identifiant de la médiathèque). */
  screen: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      const id = typeof v === "string" ? Number.parseInt(v.replace(/\D/g, ""), 10) : v;
      return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
    }),
});

const ideasOutput = z.object({
    ideas: z
      .array(
        z.object({
          title: text,
          hook: z.string().trim().default(""),
          format: z
            .string()
            .default("image")
            .transform((f) => (formatIds.includes(f) ? f : "image")),
          angle: z.string().trim().default(""),
        }),
      )
      .min(1),
  });

const outputSchemas = {
  ideas: ideasOutput,
  extractIdeas: ideasOutput,
  carouselSlides: z.object({ slides: z.array(slideText).min(1) }),
  carouselSlide: z.object({ proposals: z.array(slideText).min(1).max(5) }),
  captions: z.object({ captions: z.array(text).min(1).max(5) }),
  rewrite: z.object({ caption: text }),
  adapt: z.object({ caption: text, hashtags: z.array(z.string()).default([]) }),
  hashtags: z.object({ hashtags: z.array(z.string()).min(1) }),
  bio: z.object({ bios: z.array(text).min(1).max(5) }),
  profileAudit: z.object({
    scores: z
      .array(
        z.object({
          id: z.string(),
          score: z.coerce.number().catch(0),
          comment: z.string().trim().default(""),
        }),
      )
      .min(1),
    nameOptions: z.array(z.string().trim()).default([]),
    bioOptions: z.array(z.string().trim()).default([]),
    highlightNames: z.array(z.string().trim()).default([]),
    priorities: z.array(z.string().trim()).default([]),
  }),
  siteSummary: z.object({ summary: text.transform((t) => t.slice(0, SITE_SUMMARY_MAX)) }),
  visualBrief: z.object({ brief: text }),
  mediaAnalysis: z.object({
    description: z.string().trim().default(""),
    title: z.string().trim().default(""),
    captions: z.array(text).min(1).max(5),
    hashtags: z.array(z.string()).default([]),
    cta: z.string().trim().default(""),
  }),
};

export type AiTaskOutput<T extends AiTaskId> = z.output<(typeof outputSchemas)[T]>;

/** Tolère les réponses qui renvoient directement la liste au lieu de l'objet. */
function wrapArray(task: AiTaskId, value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const keys: Partial<Record<AiTaskId, string>> = {
    captions: "captions",
    hashtags: "hashtags",
    ideas: "ideas",
    extractIdeas: "ideas",
    bio: "bios",
    carouselSlides: "slides",
    carouselSlide: "proposals",
  };
  const key = keys[task];
  return key ? { [key]: value } : value;
}

export function parseTaskOutput<T extends AiTaskId>(
  task: T,
  raw: string,
): AiTaskOutput<T> | null {
  const json = wrapArray(task, extractJson(raw));
  const result = outputSchemas[task].safeParse(json);
  if (!result.success) return null;
  // Typographie qui trahit un texte généré (tirets longs, caractères invisibles).
  const data = cleanAiOutput(result.data);
  if ("captions" in data) data.captions = data.captions.map(cleanAiCaption);
  if ("caption" in data) data.caption = cleanAiCaption(data.caption);
  if ("hashtags" in data) {
    const tags = normalizeHashtags(data.hashtags.join(" "));
    return { ...data, hashtags: tags ? tags.split(" ") : [] } as AiTaskOutput<T>;
  }
  return data as AiTaskOutput<T>;
}

/* ------------------------------------------------------------------ */
/* Prompts                                                            */
/* ------------------------------------------------------------------ */

const VISUAL_BRIEF_REQUESTS: Record<string, string> = {
  image:
    "Rédige le brief du visuel (une image) : idée principale, texte affiché sur le visuel (8 mots maximum), composition, couleurs de la charte à utiliser, typographie, et ce qu'il faut éviter.",
  carousel:
    "Rédige le brief du carrousel : nombre de slides (5 à 8), puis pour chaque slide le texte affiché et le visuel. La première slide est une accroche forte, la dernière un appel à l'action. Précise les couleurs de la charte et la typographie.",
  video:
    "Rédige le brief de la vidéo courte (Reel / TikTok, 15 à 45 secondes) avec cette structure : ACCROCHE (0-2 s : 3 propositions sur 3 formules d'accroche différentes, chacune avec la phrase dite et le texte à l'écran), ENJEU (2-7 s, une phrase : pourquoi ça compte pour celui qui regarde), DÉROULÉ (un plan par idée, 4 secondes maximum par plan, l'image change à chaque plan, avec la phrase dite et la durée), CHUTE (les 3 dernières secondes : on tient la promesse de l'accroche, puis un seul appel à l'action), BOUCLE (la dernière phrase reprend un mot de l'accroche pour que le visionnage reboucle), TEXTE À L'ÉCRAN (6 mots maximum par carton, l'accroche affichée dès la première image, rien en bas de l'écran ni sur la droite où s'affichent la légende et les boutons, sous-titres incrustés car on regarde souvent sans le son), et l'habillage aux couleurs de la charte. Pas d'introduction : la vidéo commence directement par l'accroche.",
  story:
    "Rédige le brief de la story : séquence de 3 à 5 écrans, texte et visuel de chaque écran, sticker interactif à utiliser (sondage, question, quiz…), couleurs de la charte.",
  live:
    "Rédige le brief du live : sujet, déroulé minute par minute, questions à poser à l'audience, et visuel d'annonce aux couleurs de la charte.",
};

const EMOJI_RULES: Record<BrandBrief["emojis"], string> = {
  none: "N'utilise aucun emoji.",
  few: "Utilise quelques emojis (2 à 4 maximum), seulement quand ils apportent quelque chose.",
  many: "Utilise volontiers des emojis pour rythmer le texte.",
};

/**
 * Consignes communes : la marque, ses documents et les règles d'écriture.
 * `responseExample` : forme du JSON attendu, ou `null` pour une réponse en texte libre.
 */
export function buildSystemPrompt(
  brand: BrandContext,
  responseExample: string | null,
  { visualIdentity = false, mode = "open" }: { visualIdentity?: boolean; mode?: AiMode } = {},
): string {
  const name = brand.name || "la marque";
  const kit = brand.kit ?? null;
  const lines = [
    `Tu es le community manager de ${name}. Tu rédiges en français les contenus de ses réseaux sociaux.`,
    "",
    "# La marque",
    brand.description.trim() ||
      "Pas encore de description détaillée : reste général et n'invente rien de précis sur le produit.",
  ];
  if (kit?.positioning.trim()) lines.push(`Positionnement : ${kit.positioning.trim()}`);
  if (kit?.slogan.trim()) lines.push(`Slogan : ${kit.slogan.trim()}`);
  lines.push(
    `Public cible : ${brand.audience.trim() || "non précisé"}.`,
    `Ton : ${brand.style.trim() || "naturel, chaleureux et dynamique"}. ${
      brand.addressing === "tu" ? "Tutoie toujours ton audience." : "Vouvoie toujours ton audience."
    }`,
    `Emojis : ${EMOJI_RULES[brand.emojis]}`,
  );
  if (brand.avoid.trim()) lines.push(`À éviter absolument : ${brand.avoid.trim()}`);
  if (brand.doc?.trim()) {
    lines.push(
      "",
      `# Document de référence sur ${name} (source de vérité)`,
      mode === "strict"
        ? `Ce document décrit ${name} : offre, fonctionnalités, chiffres, prix, vocabulaire. Il fait foi : en cas de contradiction avec le reste de ce brief, suis-le. Appuie-toi dessus pour être précis, et n'avance aucun fait qui n'y figure pas.`
        : `Ce document décrit ${name} : offre, fonctionnalités, chiffres, prix, vocabulaire. Il fait foi sur tout ce qui concerne ${name} : en cas de contradiction avec le reste de ce brief, suis-le, et n'avance aucun fait sur ${name} qui n'y figure pas. Il ne limite pas le sujet du post : pour le métier, les conseils, les tendances ou la culture du réseau, appuie-toi aussi sur tes connaissances générales.`,
      '"""',
      brand.doc.trim(),
      '"""',
    );
  }
  if (brand.guides?.trim()) {
    lines.push(
      "",
      `# Guides de ${name}`,
      "Ce qui a marché sur ses posts déjà publiés, et ses règles pour vérifier un fait avant de l'écrire. Applique-les.",
      '"""',
      brand.guides.trim(),
      '"""',
    );
  }
  if (brand.site?.summary.trim()) {
    const date = brand.site.analyzedAt
      ? ` le ${new Date(brand.site.analyzedAt).toLocaleDateString("fr-FR")}`
      : "";
    lines.push(
      "",
      `# Ce que dit le site ${brand.site.url || "de la marque"} (analysé${date})`,
      "Messages, vocabulaire et appels à l'action du site : reprends-les pour rester cohérent avec lui. Le document de référence reste prioritaire.",
      '"""',
      brand.site.summary.trim(),
      '"""',
    );
  }
  lines.push(
    "",
    "# Règles d'écriture",
    "- Un français naturel, fluide et sans faute, comme un vrai community manager (jamais de traduction littérale de l'anglais).",
    "- Soigne la première ligne : c'est l'accroche.",
    "- Des phrases courtes et des paragraphes aérés (sauts de ligne).",
    "- Pas de formules creuses ni de clichés (« Dans un monde où… », « Plongez dans… », « Découvrez sans plus attendre… », « révolutionnaire », « incontournable »).",
    mode === "strict"
      ? "- N'invente jamais de chiffres, de fonctionnalités, de prix ou de promotions qui ne sont pas fournis. Reste centré sur la marque et ce qu'en dit le document de référence."
      : `- N'invente jamais de chiffres, de fonctionnalités, de prix ou de promotions de ${name}. Sur le sujet du post, tu peux apporter des conseils et des connaissances générales, mais aucun chiffre, aucune date ni aucune étude précise qui ne soit pas fournie.`,
    "- N'écris pas de hashtags dans les légendes : ils sont gérés séparément.",
  );
  if (visualIdentity && kit) {
    lines.push("", "# Charte graphique", describeBrandKit(kit));
  }
  lines.push("", HUMAN_WRITING_RULES);
  if (responseExample === null) return lines.join("\n");
  lines.push(
    "",
    "# Format de réponse",
    "Réponds uniquement avec un objet JSON valide, sans texte avant ou après et sans bloc de code, exactement de cette forme :",
    responseExample,
  );
  return lines.join("\n");
}

/** « Instagram », « Instagram et TikTok », « Instagram, TikTok et LinkedIn ». */
function platformNames(platforms: readonly PlatformId[]) {
  const labels = platforms.map((p) => PLATFORMS[p].label);
  if (!labels.length) return "ses réseaux sociaux";
  return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} et ${labels.at(-1)}`;
}

export function platformTips(
  platforms: readonly PlatformId[],
  brand: BrandContext,
  fields: readonly (keyof PlatformVoice)[] = ["tone", "writing", "hashtags"],
) {
  const list = platforms.length ? platforms : PLATFORM_IDS;
  return list.map((p) => describeVoice(p, resolveVoice(p, brand.voices?.[p]), fields)).join("\n\n");
}

export function describePost(input: PostContext, { withCaption = true } = {}): string {
  const post = postContextSchema.parse(input);
  const lines = ["# Le post", `Sujet (titre interne) : ${post.title || "non précisé"}`];
  lines.push(`Format : ${formatLabel(post.format)}`);
  lines.push(`Réseaux : ${platformNames(post.platforms)}`);
  if (post.pillar) lines.push(`Pilier de contenu : ${post.pillar}`);
  if (post.campaign) lines.push(`Campagne : ${post.campaign}`);
  const notes = post.notes.replace(GENERATED_IDEA_MARK, "").trim();
  if (notes) lines.push(`Notes et brief :\n${notes}`);
  if (post.cta.trim()) lines.push(`Appel à l'action souhaité : ${post.cta.trim()}`);
  if (post.link.trim()) lines.push(`Lien : ${post.link.trim()}`);
  if (withCaption && post.caption.trim()) {
    lines.push(`Légende actuelle :\n"""\n${post.caption.trim()}\n"""`);
  }
  if (post.research.trim()) {
    lines.push(
      "",
      "# Recherches sur le sujet (web)",
      "Notes tirées de pages lues sur internet pour ce post. Sers-t'en pour rendre le post plus précis, utile et actuel : ce sont les seuls chiffres et faits extérieurs que tu peux citer. Ne mets ni adresse ni nom de source dans la légende, sauf si c'est naturel (« selon une étude de… »).",
      '"""',
      post.research.trim(),
      '"""',
    );
  }
  return lines.join("\n");
}

function quote(caption: string) {
  return `"""\n${caption.trim()}\n"""`;
}

function carouselRules(capacity: { title: number; body: number } | null, look?: CarouselLook) {
  const space = capacity
    ? `- Le texte est posé dans un encadré du visuel, de taille limitée : titre de ${capacity.title} caractères maximum (espaces compris), texte de ${capacity.body} caractères maximum. Reste bien en dessous : un texte trop long devient trop petit pour être lu.`
    : "- Le texte est posé sur une image : chaque slide a un titre court (8 mots maximum) et, si utile, un texte de 30 mots maximum, en phrases courtes.";
  const rules = look?.accent
    ? CAROUSEL_RULES.map((rule) => rule.replace("ni de markdown", "ni de markdown (sauf les *mots* en accent)"))
    : CAROUSEL_RULES;
  return [rules[0], space, ...rules.slice(1)].join("\n");
}

const CAROUSEL_RULES = [
  "# Règles du carrousel",
  "- Slide 1 (couverture) : c'est 80 % du résultat. Un titre de 6 mots maximum, construit sur une formule d'accroche, et au plus une ligne de promesse en dessous.",
  "- Slide 2 (l'enjeu) : pourquoi ça compte pour le lecteur, en une phrase. Instagram peut remontrer le carrousel à partir de la slide 2 : elle doit tenir seule, ce n'est pas une introduction.",
  "- Slides suivantes : une seule idée par slide, un titre de 3 à 7 mots et 25 mots maximum dessous. Si une idée demande un paragraphe, c'est deux slides.",
  "- Avant-dernière slide (à partir de 6 slides) : le récapitulatif, lisible sans le reste du carrousel. C'est la slide qu'on capture et qu'on envoie.",
  "- Dernière slide : un seul appel à l'action (enregistrer, commenter un mot-clé, lien en bio pour la liste d'attente…).",
  "- Reste fidèle à la description : n'ajoute pas d'autre sujet et n'invente aucun fait.",
  "- Pas d'emojis, de hashtags ni de markdown (ils s'affichent mal sur l'image). Un « title » ou un « body » peut être vide.",
];

type CarouselLook = { kickers: boolean; accent: boolean };

/** Champs en plus selon la mise en page du Studio (kicker, source, mots en couleur d'accent). */
function lookRules({ kickers, accent }: CarouselLook): string {
  const lines: string[] = [];
  if (accent) {
    lines.push(
      "- Dans un « title », entoure 1 à 3 mots-clés d'astérisques (*comme ça*) : ils s'affichent dans la couleur d'accent. Ce sont les seuls astérisques permis.",
    );
  }
  if (kickers) {
    lines.push(
      "- « kicker » : le petit titre au-dessus du titre, 2 à 6 mots, sans phrase (la série et l'épisode sur la couverture, puis l'étape ou la catégorie : « LA RÈGLE », « 8 GO · TESTÉE »).",
      "- « source » : d'où viennent les chiffres ou les faits de la slide, en une ligne courte (« Source : ollama.com, vérifié le 29/10/2026 »). Reprends uniquement une source donnée dans la description, les notes ou les recherches. Aucune source inventée : laisse vide si la slide n'a pas de chiffre ou si sa source n'est pas fournie.",
    );
  }
  return lines.length ? ["# Mise en page", ...lines].join("\n") : "";
}

/** Exemple de réponse d'une slide, avec les champs de la mise en page. */
function slideExample({ kickers }: CarouselLook, fields: string) {
  return kickers ? `{"kicker": "…", ${fields}, "source": ""}` : `{${fields}}`;
}

/** Façon d'écrire un carrousel sur chaque réseau. */
const CAROUSEL_PLATFORM_RULES: Record<PlatformId, string[]> = {
  instagram: [
    "- Couverture qui arrête le pouce : une formule d'accroche (chiffre, erreur à éviter, promesse, question qui pique), lisible en une seconde sur un téléphone. Elle donne envie de faire glisser (une promesse qui se tient dans les slides suivantes).",
    "- Chaque slide se termine sur une raison de passer à la suivante (question ouverte, « mais… », liste numérotée) : le temps passé et les retours en arrière comptent pour Instagram.",
    "- Contenu qu'on a envie d'enregistrer ou d'envoyer à un ami : une astuce concrète, une liste, un avant/après, des chiffres. Pas de slogan creux.",
    "- Parle au lecteur (tu), avec ses mots à lui. Phrases très courtes, un mot fort par titre.",
    "- Dernière slide : un seul appel à l'action, de préférence « enregistre pour plus tard », « envoie-le à un créateur qui en a besoin », commenter un mot-clé, ou « lien en bio ».",
  ],
  tiktok: [
    "- Carrousel photo TikTok : ton plus direct et oral, comme si tu parlais face caméra. Couverture façon « POV » ou « personne ne te dit que… ».",
    "- Peu de texte par slide (une phrase forte), du rythme d'une slide à l'autre, une chute sur la dernière.",
    "- Dernière slide : « suis pour la suite », « commente si… » ou « lien en bio ».",
  ],
  linkedin: [
    "- Carrousel LinkedIn (document) : ton professionnel mais humain, orienté retour d'expérience et enseignement concret.",
    "- Titres affirmatifs et précis, un peu plus de contexte par slide (chiffres, exemples), pas d'argot.",
    "- Dernière slide : inviter à réagir en commentaire ou à suivre la page.",
  ],
  facebook: [
    "- Carrousel Facebook : ton chaleureux et accessible, phrases simples, l'utilité avant tout.",
    "- Dernière slide : un appel clair (partager, commenter, visiter le site).",
  ],
  youtube: ["- Ton pédagogique et clair, un enseignement par slide."],
  x: ["- Ton tranché et concis, une idée choc par slide (peu d'images sur X : va à l'essentiel)."],
};

function platformCarouselRules(platform: PlatformId | null, brand: BrandContext): string {
  if (!platform) return "";
  const label = PLATFORMS[platform].label;
  return [
    `# Écrire pour ${label}`,
    `Ce carrousel est publié sur ${label} : adapte le ton, le vocabulaire et l'appel à l'action à ce réseau.`,
    ...CAROUSEL_PLATFORM_RULES[platform],
    "",
    platformTips([platform], brand, ["tone", "writing"]),
    ...section(platformSkillsPrompt([platform], brand.skills, "carousel")),
  ].join("\n");
}

type ScreenList = { id: number; title: string; description: string }[];

/** Écrans de l'app que l'IA peut poser sur les slides. */
function screenRules(screens: ScreenList, capacity: { title: number; body: number } | null) {
  if (!screens.length) return "";
  return [
    "# Écrans de l'app disponibles",
    "Captures de l'app (en construction, données de démonstration) que tu peux poser sur une slide, comme sur les visuels de la marque : titre et texte en haut, capture en bas.",
    ...screens.map((s) => `- ${s.id} : ${s.title} — ${s.description}`),
    "",
    "Pour chaque slide, indique dans « screen » l'identifiant de l'écran qui illustre exactement son propos, ou null.",
    "- Mets un écran sur les slides qui présentent une fonctionnalité ; la couverture et la dernière slide peuvent rester sans écran (ou avec le Media Kit / la page d'accueil si c'est le sujet).",
    "- Un écran ne sert qu'une fois par carrousel.",
    capacity
      ? `- Sur une slide avec écran, le texte a moins de place : titre de ${capacity.title} caractères maximum, texte de ${capacity.body} caractères maximum.`
      : "- Sur une slide avec écran, le texte doit être court (titre de 6 mots, texte de 20 mots maximum).",
    "- Les noms, chiffres et marques visibles sur les captures sont fictifs : ne les reprends jamais dans le texte comme des faits (pas de « Camille gagne 1 850 € »).",
  ].join("\n");
}

function slideRoleHint(index: number, total: number) {
  const role = slideRole(index, total);
  if (role === "cover") return "couverture : l'accroche";
  if (role === "end") return "dernière slide : l'appel à l'action";
  return "slide de contenu";
}

function describeCarousel(
  title: string,
  description: string,
  slides: readonly {
    title: string;
    body: string;
    visual?: string;
    capacity?: { title: number; body: number } | null;
  }[],
) {
  const lines = [
    "# Le carrousel",
    `Sujet : ${title.trim() || "non précisé"}`,
    `Description du post (à suivre précisément) :\n"""\n${description.trim()}\n"""`,
    `Nombre de slides : ${slides.length}`,
    "",
    "# Texte actuel des slides",
  ];
  slides.forEach((slide, i) => {
    const text = [
      slide.title.trim() && `titre : « ${slide.title.trim()} »`,
      slide.body.trim() && `texte : « ${slide.body.trim()} »`,
    ]
      .filter(Boolean)
      .join(" / ");
    const extra = [
      slide.visual?.trim() && `avec ${slide.visual.trim()} sous le texte : le texte doit l'introduire`,
      slide.capacity &&
        `place réduite : titre de ${slide.capacity.title} caractères maximum, texte de ${slide.capacity.body} caractères maximum`,
    ].filter(Boolean);
    lines.push(
      `- Slide ${i + 1} (${[slideRoleHint(i, slides.length), ...extra].join(" ; ")}) : ${text || "vide"}`,
    );
  });
  return lines.join("\n");
}

type Builder<T extends AiTaskId> = (
  input: z.output<(typeof inputSchemas)[T]>,
  brand: BrandContext,
) => ChatMessage[];

const builders: { [T in AiTaskId]: Builder<T> } = {
  captions: ({ post, instruction }, brand) => {
    const platforms = post.platforms;
    const user = [
      describePost(post),
      "",
      "# Codes des réseaux",
      platformTips(platforms, brand),
      ...section(platformSkillsPrompt(platforms, brand.skills, "caption")),
      "",
      hookGuide(),
      "",
      "# Rôle de la légende",
      post.format === "video"
        ? "C'est une vidéo : elle porte déjà son accroche (à l'oral et à l'écran). La légende ne la répète pas : sa première ligne donne le contexte ou l'appel à l'action, le corps glisse naturellement les mots que le public taperait dans la recherche."
        : "La légende fait le travail : sa première ligne est l'accroche, elle tient dans les 125 premiers caractères (ce qui s'affiche avant « plus ») et s'arrête sur une promesse, pas au milieu d'une phrase. Ensuite 2 à 6 paragraphes courts séparés par une ligne vide, avec les mots que le public taperait dans la recherche.",
      "Jamais de salutation, de hashtag ni d'emoji en premier caractère. Un seul appel à l'action. Pas de lien dans une légende Instagram ou TikTok (il n'est pas cliquable) : « lien en bio ». Pas de hashtags dans la légende (ils sont gérés à part).",
      "",
      "# Demande",
      `Propose 3 légendes différentes pour ce post, chacune construite sur une formule d'accroche différente (choisies parmi celles qui collent vraiment au sujet). Chaque légende est complète et prête à publier${
        platforms.length > 1 ? " ; elle doit convenir aux deux réseaux (elle pourra être adaptée ensuite)" : ""
      }${post.cta.trim() ? " et intègre l'appel à l'action souhaité" : ""}.`,
    ];
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(brand, '{"captions": ["légende 1", "légende 2", "légende 3"]}', { mode: post.aiMode }),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  rewrite: ({ post, caption, mode, instruction }, brand) => {
    const task =
      mode === "custom"
        ? `Réécris cette légende en suivant cette consigne : ${instruction.trim() || "améliore-la"}.`
        : REWRITE_INSTRUCTIONS[mode];
    return [
      {
        role: "system",
        content: buildSystemPrompt(brand, '{"caption": "la légende réécrite"}', { mode: post.aiMode }),
      },
      {
        role: "user",
        content: [
          describePost(post, { withCaption: false }),
          ...section(platformSkillsPrompt(post.platforms, brand.skills, "caption", 4_000)),
          "",
          "# Légende à retravailler",
          quote(caption),
          "",
          "# Demande",
          task,
        ].join("\n"),
      },
    ];
  },

  adapt: ({ post, caption, platform }, brand) => {
    const config = PLATFORMS[platform];
    const existing = post.hashtags.trim();
    const limit = config.hashtagLimit;
    const user = [
      describePost(post, { withCaption: false }),
      "",
      "# Légende d'origine",
      quote(caption),
      "",
      `# Codes de ${config.label}`,
      platformTips([platform], brand),
      ...section(platformSkillsPrompt([platform], brand.skills, "caption")),
      "",
      ...(platform === "instagram" || platform === "tiktok" ? [hookGuide(), ""] : []),
      "# Règles",
      platform === "instagram" && post.format !== "video"
        ? "- Première ligne = l'accroche, dans les 125 premiers caractères (ce qui s'affiche avant « plus »), qui s'arrête sur une promesse. Si l'accroche d'origine est faible, reprends-la avec une formule d'accroche adaptée."
        : "- L'accroche dès les premiers mots.",
      "- Paragraphes courts séparés par une ligne vide. Jamais de salutation, d'emoji ni de hashtag en premier caractère.",
      "- Un seul appel à l'action, en une phrase (par exemple « Rejoins la liste d'attente, lien en bio »)." +
        (platform === "instagram" || platform === "tiktok" ? " Pas de lien : « lien en bio »." : ""),
      "- Aucun hashtag dans « caption » : ils vont dans « hashtags ».",
      "",
      "# Hashtags",
      existing
        ? `Hashtags du post : ${existing}. Garde les plus pertinents pour ${config.label} (tu peux en remplacer un s'il est générique).`
        : `Propose des hashtags pertinents pour ${config.label}.`,
      `Respecte le nombre conseillé dans les codes du réseau${limit !== null ? ` (${limit} au maximum)` : ""}, sans accents ni espaces.`,
      "",
      "# Demande",
      `Adapte cette légende pour ${config.label} en respectant les codes de ce réseau. Garde le message et le ton de la marque.`,
    ];
    return [
      {
        role: "system",
        content: buildSystemPrompt(brand, '{"caption": "la légende adaptée", "hashtags": ["#exemple", "#autreexemple"]}', { mode: post.aiMode }),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  hashtags: ({ post, count }, brand) => {
    const existing = post.hashtags.trim();
    // Limites des réseaux ciblés (tous si aucun n'est choisi).
    const limits = (post.platforms.length ? post.platforms : PLATFORM_IDS)
      .filter((p) => PLATFORMS[p].hashtagLimit !== null)
      .map((p) => `${PLATFORMS[p].label} en accepte au maximum ${PLATFORMS[p].hashtagLimit}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(brand, '{"hashtags": ["#exemple", "#autreexemple"]}', { mode: post.aiMode }),
      },
      {
        role: "user",
        content: [
          describePost(post),
          "",
          "# Demande",
          `Propose ${count} hashtags pertinents pour ce post : un mélange de hashtags populaires, de hashtags de niche et de hashtags liés à la marque.`,
          "Écris-les sans accents ni espaces. Préfère le français, sauf quand le hashtag anglais est nettement plus utilisé dans le domaine.",
          limits.length ? `Nombre de hashtags par post : ${limits.join(" ; ")}.` : "",
          "",
          "# Codes des réseaux (respecte le nombre de hashtags conseillé : en cas de plusieurs réseaux, celui du plus restrictif)",
          platformTips(post.platforms, brand, ["hashtags"]),
          existing ? `Ne propose pas ceux-ci, déjà présents : ${existing}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ];
  },

  visualBrief: ({ post, instruction }, brand) => {
    const request = VISUAL_BRIEF_REQUESTS[post.format] ?? VISUAL_BRIEF_REQUESTS.image;
    const user = [
      describePost(post),
      "",
      ...(post.format === "video" || post.format === "carousel" ? [hookGuide(), ""] : []),
      "# Demande",
      request,
      "Le brief doit être concret et directement utilisable dans Canva ou pour un tournage. Utilise uniquement les couleurs (avec leurs codes) et les polices de la charte graphique.",
      "Mise en forme : de courtes sections avec un titre en MAJUSCULES et des tirets, sans markdown (pas de #, pas de **).",
    ];
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          '{"brief": "IDÉE\\n- …\\n\\nTEXTE AFFICHÉ\\n- …\\n\\nCOULEURS\\n- …"}',
          { visualIdentity: true, mode: post.aiMode },
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  carouselSlides: ({ title, description, slides, capacity, screens, screenCapacity, platform, look, instruction }, brand) => {
    const filled = slides.some((slide) => slide.title.trim() || slide.body.trim());
    const extra = lookRules(look);
    const user = [
      describeCarousel(title, description, slides),
      "",
      carouselRules(capacity, look),
      ...(extra ? ["", extra] : []),
      ...(platform ? ["", platformCarouselRules(platform, brand)] : []),
      ...(screens.length ? ["", screenRules(screens, screenCapacity)] : []),
      "",
      hookGuide(),
      "",
      "# Demande",
      `Rédige les ${slides.length} slides de ce carrousel, dans l'ordre, en suivant précisément la description.${
        filled
          ? " Certaines slides ont déjà un texte : garde l'idée de ceux qui sont bons, améliore les autres et complète les slides vides."
          : ""
      }`,
      `Renvoie exactement ${slides.length} slides.`,
    ];
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          `{"slides": [${slideExample(
            look,
            `"title": "titre de la slide 1", "body": "texte de la slide 1"${screens.length ? ', "screen": null' : ""}`,
          )}, ${slideExample(look, `"title": "…", "body": "…"${screens.length ? ', "screen": 12' : ""}`)}]}`,
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  carouselSlide: ({ title, description, slides, index, capacity, platform, look, instruction }, brand) => {
    const current = slides[index];
    const hasText = Boolean(current.title.trim() || current.body.trim());
    const extra = lookRules(look);
    const user = [
      describeCarousel(title, description, slides),
      "",
      carouselRules(capacity, look),
      ...(extra ? ["", extra] : []),
      ...(platform ? ["", platformCarouselRules(platform, brand)] : []),
      ...(index === 0 ? ["", hookGuide()] : []),
      "",
      "# Demande",
      `${hasText ? "Propose 3 versions améliorées" : "Propose 3 versions"} de la slide ${index + 1} (${slideRoleHint(index, slides.length)}). Elles doivent s'enchaîner avec les autres slides, sans les répéter, et suivre précisément la description.`,
    ];
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          `{"proposals": [${[0, 1, 2].map(() => slideExample(look, '"title": "titre", "body": "texte"')).join(", ")}]}`,
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  mediaAnalysis: ({ post, images, hasVideo, count, instruction }, brand) => {
    const existing = post.hashtags.trim();
    const request = [
      "# Demande",
      "Regarde attentivement les médias ci-dessus : c'est ce qui sera publié. Appuie-toi sur ce qu'on y voit réellement, et sur le sujet et les notes du post quand ils sont précisés.",
      "- description : décris objectivement ce que montrent les médias (sujet, lieu, ambiance, texte visible à l'écran), en 2 ou 3 phrases. N'essaie pas de reconnaître les personnes.",
      "- title : un titre interne court (6 mots maximum) qui résume le post.",
      `- captions : 3 légendes différentes, complètes et prêtes à publier, qui parlent de ce qu'on voit, avec des accroches variées (une question, une affirmation forte, une mini-histoire)${
        post.cta.trim() ? " et qui intègrent l'appel à l'action souhaité" : ""
      }.`,
      `- hashtags : ${count} hashtags pertinents pour ces médias, un mélange de hashtags populaires, de niche et liés à la marque, sans accents ni espaces.${
        existing ? ` Ne propose pas ceux-ci, déjà présents : ${existing}` : ""
      }`,
      `- cta : ${
        post.cta.trim()
          ? "l'appel à l'action souhaité, reformulé si besoin pour coller aux médias"
          : "un appel à l'action court adapté au post"
      }.`,
    ];
    if (hasVideo) {
      request.push(
        "Pour les vidéos, tu ne vois que quelques images extraites, dans l'ordre chronologique, et tu n'entends pas le son : n'invente rien sur ce qui est dit ni sur la musique.",
      );
    }
    if (instruction.trim()) request.push(`Consigne supplémentaire : ${instruction.trim()}`);

    const intro = [
      describePost(post),
      "",
      "# Codes des réseaux",
      platformTips(post.platforms, brand),
      ...section(platformSkillsPrompt(post.platforms, brand.skills, "caption", 6_000)),
      "",
      "# Médias du post",
    ];
    const content: ChatContentPart[] = [{ type: "text", text: intro.join("\n") }];
    for (const image of images) {
      content.push(
        { type: "text", text: image.label || "Média" },
        { type: "image_url", image_url: { url: image.dataUrl } },
      );
    }
    content.push({ type: "text", text: request.join("\n") });

    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          '{"description": "ce que montrent les médias", "title": "titre court", "captions": ["légende 1", "légende 2", "légende 3"], "hashtags": ["#exemple", "#autreexemple"], "cta": "appel à l\'action"}',
          { mode: post.aiMode },
        ),
      },
      { role: "user", content },
    ];
  },

  siteSummary: ({ url, pages }, brand) => {
    const user = [
      `# Pages du site ${url}`,
      ...pages.flatMap((page, i) => [
        "",
        `## Page ${i + 1} : ${page.title || page.url}`,
        `Adresse : ${page.url}`,
        '"""',
        page.text.trim(),
        '"""',
      ]),
      "",
      "# Demande",
      "Résume ce site pour l'équipe qui rédige les posts de la marque sur les réseaux sociaux. Ce résumé leur servira de mémo à chaque rédaction.",
      "Sections, chacune avec un titre en MAJUSCULES suivi de tirets (pas de markdown) :",
      "- MESSAGES CLÉS : la promesse, les bénéfices mis en avant, les chiffres et arguments exacts du site.",
      "- OFFRE : ce qui est proposé, pour qui, à quelles conditions (prix, gratuité, étapes de lancement), tel que le site le dit.",
      "- VOCABULAIRE : les mots et expressions du site à reprendre (noms des fonctionnalités, formules récurrentes, tutoiement ou vouvoiement).",
      "- APPELS À L'ACTION : ce que le site demande de faire, avec ses formulations.",
      "- PAGES UTILES : les pages vers lesquelles renvoyer dans les posts, avec leur adresse.",
      `Reste fidèle au site : recopie les chiffres et formulations exacts, n'invente rien. ${SITE_SUMMARY_MAX - 500} caractères maximum.`,
    ];
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          // Le résumé décrit le site tel qu'il est : sans document de référence ni ancien résumé.
          { ...brand, doc: null, guides: null, site: null },
          '{"summary": "MESSAGES CLÉS\\n- …\\n\\nOFFRE\\n- …"}',
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  bio: ({ platform, handle, currentBio, bioLink, instruction }, brand) => {
    const config = PLATFORMS[platform];
    const user = [
      "# Demande",
      `Propose 3 bios différentes pour le profil ${config.label} de la marque${handle ? ` (@${handle})` : ""}.`,
      `Limite stricte : ${config.bioLimit} caractères maximum par bio, espaces, emojis et sauts de ligne compris. Compte bien : une bio trop longue est refusée par ${config.label}.`,
      "Une bonne bio dit en un coup d'œil ce que fait la marque et pour qui, donne une raison de s'abonner et, si la place le permet, invite à cliquer sur le lien.",
      `Consignes pour ${config.label} : ${resolveVoice(platform, brand.voices?.[platform]).bio}`,
      `Ton sur ${config.label} : ${resolveVoice(platform, brand.voices?.[platform]).tone}`,
      "Ne mets pas de hashtags.",
    ];
    if (bioLink.trim()) user.push(`Lien en bio (affiché sous la bio) : ${bioLink.trim()}`);
    if (currentBio.trim()) user.push(`Bio actuelle, à améliorer :\n${quote(currentBio)}`);
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    return [
      {
        role: "system",
        content: buildSystemPrompt(brand, '{"bios": ["bio 1", "bio 2", "bio 3"]}'),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  profileAudit: ({ handle, nameField, bio, bioLink, highlights, pinned, notes, activity }, brand) => {
    const unknown = "non renseigné";
    const user = [
      "# Le profil Instagram de la marque",
      `Pseudo : ${handle ? `@${handle}` : unknown}`,
      `Champ « Nom » (en gras) : ${nameField || unknown}`,
      `Bio :\n${bio.trim() ? quote(bio) : unknown}`,
      `Lien : ${bioLink || unknown}`,
      `Stories à la une : ${highlights || unknown}`,
      `Posts épinglés : ${pinned || unknown}`,
      activity ? `Activité (calculée par l'app) : ${activity}` : "",
      notes ? `Autres informations : ${notes}` : "",
      "",
      `# Grille (${PROFILE_RUBRIC_TOTAL} points)`,
      ...PROFILE_RUBRIC.map((item) => `- ${item.id} (${item.points} pts) ${item.label} : note maximale si ${item.full} Erreur courante : ${item.fail}`),
      "",
      "# Demande",
      "Note honnêtement chaque critère de la grille (de 0 à son maximum de points) et explique la note en une phrase. Une note généreuse n'aide personne : la plupart des profils font entre 30 et 50 au premier passage.",
      "Si une information n'est pas renseignée, ne l'invente pas : mets une note basse et dis ce qu'il faut vérifier.",
      "Puis propose : 3 versions du champ « Nom » (30 caractères maximum, « Marque | mots que le public cherche »), 3 bios (150 caractères maximum, la 1re ligne dit à qui s'adresse le compte et ce qui change pour lui), 4 à 6 noms de stories à la une, et les corrections par ordre de points perdus (la plus rentable d'abord).",
    ].filter((line) => line !== "");
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          `{"scores": [${PROFILE_RUBRIC.slice(0, 2).map((i) => `{"id": "${i.id}", "score": 4, "comment": "…"}`).join(", ")}, …], "nameOptions": ["…", "…", "…"], "bioOptions": ["…", "…", "…"], "highlightNames": ["…"], "priorities": ["…"]}`,
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  ideas: ({ pillar, platforms, count, instruction, existingTitles }, brand) => {
    const user = [
      "# Demande",
      `Propose ${count} idées de posts${pillar ? ` pour le pilier de contenu « ${pillar} »` : ""}, à publier sur ${platformNames(platforms)}.`,
      "Chaque idée doit être concrète et réalisable par une petite équipe, avec un angle précis : une situation, une astuce, une coulisse, une question, un avant/après… (pas simplement « présenter l'app »).",
      "L'accroche (« hook ») de chaque idée suit une des formules d'accroche ci-dessous, en variant les formules d'une idée à l'autre.",
      "Une idée = une seule idée : si un sujet en contient deux, ce sont deux idées. Choisis le format selon la forme de l'idée : une suite d'étapes ou une liste à relire = carrousel ; quelque chose qui bouge, un visage, un résultat à voir se produire = vidéo.",
      `Varie les formats. Formats possibles : ${FORMATS.map((f) => `${f.id} (${f.label})`).join(", ")}.`,
    ];
    if (instruction.trim()) user.push(`Consigne supplémentaire : ${instruction.trim()}`);
    if (existingTitles.length) {
      user.push(
        "",
        "Évite de reprendre ces idées déjà prévues :",
        ...existingTitles.map((t) => `- ${t}`),
      );
    }
    user.push("", "# Codes des réseaux", platformTips(platforms, brand, ["tone", "writing"]), "", hookGuide());
    return [
      {
        role: "system",
        content: buildSystemPrompt(
          brand,
          '{"ideas": [{"title": "titre court de l\'idée", "hook": "l\'accroche (première phrase du post)", "format": "carousel", "angle": "en 1 ou 2 phrases : ce que montre le post et pourquoi il intéresse la cible"}]}',
        ),
      },
      { role: "user", content: user.join("\n") },
    ];
  },

  extractIdeas: ({ text, platforms }, brand) => [
    {
      role: "system",
      content: buildSystemPrompt(
        brand,
        '{"ideas": [{"title": "titre court de l\'idée", "hook": "l\'accroche (première phrase du post)", "format": "carousel", "angle": "en 1 ou 2 phrases : ce que montre le post et pourquoi il intéresse la cible"}]}',
      ),
    },
    {
      role: "user",
      content: [
        "# Message de l'assistant",
        quote(text),
        "",
        "# Demande",
        `Relève les idées de posts proposées dans ce message (pour ${platformNames(platforms)}), une entrée par idée, dans l'ordre. Reprends leur contenu sans en inventer : si une idée n'a pas d'accroche, écris-en une courte qui colle à l'idée.`,
        `Choisis le format selon la forme de l'idée. Formats possibles : ${FORMATS.map((f) => `${f.id} (${f.label})`).join(", ")}.`,
        "S'il n'y a aucune idée de post dans le message, renvoie une liste vide.",
      ].join("\n"),
    },
  ],
};

export function isAiTaskId(value: unknown): value is AiTaskId {
  return typeof value === "string" && value in inputSchemas;
}

/** Valide l'entrée d'une tâche et construit les messages à envoyer au modèle. */
export function buildTaskMessages(
  task: AiTaskId,
  input: unknown,
  brand: BrandContext,
): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  const parsed = inputSchemas[task].safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Demande invalide" };
  }
  const build = builders[task] as Builder<AiTaskId>;
  return { ok: true, messages: build(parsed.data as never, brand) };
}
