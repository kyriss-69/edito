import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Couleur invalide (format #RRGGBB)");

const colorSchema = z.object({
  name: z.string().trim().max(60).default(""),
  hex,
  role: z.string().max(200).default(""),
  /** Part indicative dans les visuels, en %. */
  share: z.number().int().min(0).max(100).nullable().default(null),
});

const paletteSchema = z.object({
  name: z.string().trim().max(60).default("Palette"),
  colors: z.array(colorSchema).max(20).default([]),
});

export const brandKitSchema = z.object({
  slogan: z.string().max(120).default(""),
  positioning: z.string().max(500).default(""),
  palettes: z.array(paletteSchema).max(6).default([]),
  gradient: z.array(hex).max(5).default([]),
  fonts: z
    .object({
      heading: z.string().max(60).default(""),
      headingFallback: z.string().max(60).default(""),
      body: z.string().max(60).default(""),
      bodyFallback: z.string().max(60).default(""),
    })
    .prefault({}),
  guidelines: z.string().max(5_000).default(""),
  /** Couleurs proposées aux nouveaux carrousels du Studio (vide : couleurs par défaut). */
  studio: z
    .object({
      background: hex.nullable().default(null),
      title: hex.nullable().default(null),
      text: hex.nullable().default(null),
      /** Mots du titre écrits *entre astérisques*. */
      accent: hex.nullable().default(null),
      /** Espacement des lettres des titres, en em (négatif : resserré). */
      titleTracking: z.number().min(-0.1).max(0.1).nullable().default(null),
      /** Haut du fond en dégradé radial (vers `background`). */
      gradientTop: hex.nullable().default(null),
      /** Halos flous sur le fond (haut à gauche, bas à droite). */
      halos: z.array(hex).max(2).default([]),
      /** Pied de slide (« @tamarque · nom de la série »). */
      footer: z.string().max(80).default(""),
      /** Points de pagination en bas à droite. */
      pagination: z.boolean().default(false),
      /** L'assistant écrit un kicker et une note de source pour chaque slide. */
      kickers: z.boolean().default(false),
    })
    .prefault({}),
});

export type BrandKit = z.infer<typeof brandKitSchema>;
export type BrandColor = BrandKit["palettes"][number]["colors"][number];

/**
 * Charte de départ d'un nouvel espace, à remplacer dans Marque › Charte (ou par
 * `brandKit` dans `workspaces.json`).
 */
export const DEFAULT_BRAND_KIT: BrandKit = brandKitSchema.parse({
  palettes: [
    {
      name: "Palette principale",
      colors: [
        { name: "Fond", hex: "#FAF7F2", role: "Fond principal", share: 50 },
        { name: "Encre", hex: "#1F2937", role: "Titres et textes", share: 25 },
        { name: "Accent", hex: "#E4572E", role: "Boutons, appels à l'action, mots-clés", share: 15 },
        { name: "Secondaire", hex: "#3B82F6", role: "Éléments secondaires", share: 10 },
      ],
    },
  ],
  fonts: {
    heading: "Outfit Bold",
    headingFallback: "Inter",
    body: "Plus Jakarta Sans Regular",
    bodyFallback: "Inter",
  },
  studio: { background: "#FAF7F2", title: null, text: "#1F2937", accent: "#E4572E", titleTracking: -0.025 },
});

export function parseBrandKit(raw: unknown, fallback: BrandKit = DEFAULT_BRAND_KIT): BrandKit {
  const result = brandKitSchema.safeParse(raw);
  return result.success ? result.data : fallback;
}

/** Résumé texte de la charte, transmis à l'assistant IA. */
export function describeBrandKit(kit: BrandKit): string {
  const lines: string[] = [];
  for (const palette of kit.palettes) {
    if (!palette.colors.length) continue;
    lines.push(`${palette.name} :`);
    for (const c of palette.colors) {
      const details = [c.role, c.share !== null ? `${c.share} %` : ""].filter(Boolean).join(", ");
      lines.push(`- ${c.name || "Couleur"} ${c.hex.toUpperCase()}${details ? ` (${details})` : ""}`);
    }
  }
  if (kit.gradient.length > 1) lines.push(`Dégradé : ${kit.gradient.join(" → ")}`);
  const { heading, headingFallback, body, bodyFallback } = kit.fonts;
  if (heading) lines.push(`Police des titres : ${heading}${headingFallback ? ` (substitut : ${headingFallback})` : ""}`);
  if (body) lines.push(`Police des textes : ${body}${bodyFallback ? ` (substitut : ${bodyFallback})` : ""}`);
  if (kit.guidelines.trim()) lines.push("Règles :", kit.guidelines.trim());
  return lines.join("\n");
}
