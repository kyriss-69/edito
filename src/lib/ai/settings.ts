import { z } from "zod";

import { voiceOverrideSchema } from "@/lib/ai/platform-voice";
import { PLATFORM_IDS } from "@/lib/platforms";

export const EMOJI_LEVELS = [
  { id: "none", label: "Aucun emoji" },
  { id: "few", label: "Quelques emojis" },
  { id: "many", label: "Beaucoup d'emojis" },
] as const;

/** Longueur maximale des champs du brief de marque (envoyé à chaque demande). */
export const BRAND_LIMITS = {
  name: 80,
  description: 5_000,
  audience: 3_000,
  style: 1_000,
  avoid: 2_000,
} as const;

const nf = new Intl.NumberFormat("fr-FR");
const tooLong = (field: string, max: number) =>
  `${field} : ${nf.format(max)} caractères maximum.`;

export const AI_PROVIDERS = [
  { id: "lmstudio", label: "LM Studio (sur ton ordinateur)" },
  { id: "openrouter", label: "OpenRouter (en ligne)" },
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number]["id"];

/** API d'OpenRouter (compatible OpenAI). La clé est rangée à part (`secrets`), jamais envoyée au navigateur. */
export const OPENROUTER_URL = "https://openrouter.ai/api";

export const aiSettingsSchema = z.object({
  /** Qui fait tourner le modèle : LM Studio en local, ou OpenRouter. */
  provider: z.enum(["lmstudio", "openrouter"]).default("lmstudio"),
  /** Adresse du serveur local de LM Studio. */
  baseUrl: z.string().trim().max(200).default("http://localhost:1234"),
  /** Identifiant du modèle chargé dans LM Studio. */
  model: z.string().trim().max(200).default(""),
  /** Identifiant du modèle sur OpenRouter (ex. « qwen/qwen3.8-27b:free »). */
  openrouterModel: z.string().trim().max(200).default(""),
  temperature: z.number().min(0).max(1.5).default(0.7),
  brand: z
    .object({
      name: z
        .string()
        .trim()
        .max(BRAND_LIMITS.name, tooLong("Nom de la marque", BRAND_LIMITS.name))
        .default(""),
      description: z
        .string()
        .max(BRAND_LIMITS.description, tooLong("Ce qu'est la marque", BRAND_LIMITS.description))
        .default(""),
      audience: z
        .string()
        .max(BRAND_LIMITS.audience, tooLong("Public cible", BRAND_LIMITS.audience))
        .default(""),
      style: z
        .string()
        .max(BRAND_LIMITS.style, tooLong("Style d'écriture", BRAND_LIMITS.style))
        .default("naturel, chaleureux et dynamique"),
      addressing: z.enum(["tu", "vous"]).default("tu"),
      emojis: z.enum(["none", "few", "many"]).default("few"),
      avoid: z.string().max(BRAND_LIMITS.avoid, tooLong("À éviter", BRAND_LIMITS.avoid)).default(""),
    })
    .prefault({}),
  /** Façon de s'exprimer sur chaque réseau (champs vides = consignes par défaut). */
  voices: z.partialRecord(z.enum(PLATFORM_IDS), voiceOverrideSchema).default({}),
  /** Accès à internet de l'assistant (recherche, lecture de pages, captures d'écran). */
  web: z
    .object({
      enabled: z.boolean().default(true),
      /** Site de la marque, analysé dans Marque › Identité et proposé pour les captures. */
      siteUrl: z.string().trim().max(500).default(""),
    })
    .prefault({}),
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;
export type BrandBrief = AiSettings["brand"];

export const DEFAULT_AI_SETTINGS: AiSettings = aiSettingsSchema.parse({});

/** Lit des réglages stockés, en complétant les valeurs manquantes. */
export function parseAiSettings(raw: unknown): AiSettings {
  const result = aiSettingsSchema.safeParse(raw ?? {});
  return result.success ? result.data : DEFAULT_AI_SETTINGS;
}

/** Modèle utilisé : celui de LM Studio ou celui d'OpenRouter, selon le fournisseur. */
export function activeModel(settings: Pick<AiSettings, "provider" | "model" | "openrouterModel">) {
  return settings.provider === "openrouter" ? settings.openrouterModel : settings.model;
}

/** "http://localhost:1234/v1/" → "http://localhost:1234" */
export function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}
