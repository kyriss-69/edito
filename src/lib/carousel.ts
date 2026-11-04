import { z } from "zod";

import type { BrandKit } from "@/lib/brand";

/**
 * Studio carrousel : slides (titre + texte) posées sur un mockup PNG.
 * Ce module contient les données et la mise en page du texte, sans dépendre
 * du navigateur (la mesure du texte est fournie par l'appelant).
 */

export const MIN_SLIDES = 1;
/** Instagram accepte 20 images par carrousel. */
export const MAX_SLIDES = 20;
export const DEFAULT_SLIDE_COUNT = 6;
/** Longueur maximale de la description d'un carrousel (envoyée à l'IA). */
export const CAROUSEL_DESCRIPTION_MAX = 5_000;
export const DEFAULT_TEXT_COLOR = "#3B211B";
/** Taille utilisée sans mockup (format portrait 4:5 d'Instagram). */
export const DEFAULT_SLIDE_SIZE = { width: 1080, height: 1350 };
/** Fond utilisé sans mockup (crème de la charte). */
export const BLANK_BACKGROUND = "#FFF1DF";

export const SLIDE_LIMITS = { title: 200, body: 1_000, kicker: 80, source: 200 } as const;

export const IMAGE_FRAMES = [
  { id: "browser", label: "Navigateur" },
  { id: "phone", label: "Téléphone" },
  { id: "card", label: "Carte" },
  { id: "paper", label: "Carte blanche" },
  { id: "none", label: "Sans cadre" },
] as const;
export type ImageFrame = (typeof IMAGE_FRAMES)[number]["id"];

/** Image posée sur une slide (capture d'écran de la bibliothèque), dans un cadre. */
export const slideImageSchema = z.object({
  assetId: z.number().int().positive(),
  /** Largeur / hauteur de l'image : sert à placer le texte sans charger l'image. */
  ratio: z.number().min(0.05).max(20),
  frame: z.enum(IMAGE_FRAMES.map((f) => f.id) as [ImageFrame, ...ImageFrame[]]).default("browser"),
  /** Adresse affichée dans la barre du navigateur ou du téléphone (vide : pas de barre d'adresse). */
  url: z.string().max(200).default(""),
  /** Largeur du cadre, en % de la largeur de la slide. */
  width: z.number().min(10).max(100).default(68),
  /** Centre horizontal du cadre, en % de la largeur. */
  x: z.number().min(0).max(100).default(50),
  /** Haut du cadre, en % de la hauteur (le cadre peut dépasser en bas, comme sur les visuels de la marque). */
  y: z.number().min(-50).max(100).default(58),
  /** Rotation en degrés. */
  rotation: z.number().min(-20).max(20).default(0),
  /** Libellé en capitales au-dessus de l'image : d'où vient la capture (« LA TAILLE, SUR OLLAMA.COM »). */
  label: z.string().max(120).default(""),
});
export type SlideImage = z.infer<typeof slideImageSchema>;

/** Position et taille par défaut selon le cadre. */
export const FRAME_DEFAULTS: Record<ImageFrame, Pick<SlideImage, "width" | "x" | "y" | "rotation">> = {
  browser: { width: 68, x: 50, y: 58, rotation: 0 },
  phone: { width: 30, x: 50, y: 60, rotation: 0 },
  card: { width: 62, x: 50, y: 62, rotation: 0 },
  paper: { width: 76, x: 50, y: 50, rotation: 0 },
  none: { width: 62, x: 50, y: 62, rotation: 0 },
};

/** Description de l'image d'une slide, pour l'IA : « capture d'écran de tamarque.fr dans un téléphone ». */
export function describeSlideImage(image: SlideImage | null): string {
  if (!image) return "";
  const where = {
    browser: "dans une fenêtre de navigateur",
    phone: "dans un téléphone",
    card: "en carte",
    paper: "dans une carte blanche",
    none: "",
  }[image.frame];
  return [image.url.trim() ? `capture d'écran de ${image.url.trim()}` : "capture d'écran", where].filter(Boolean).join(" ");
}

/** Cadre proposé pour une image : téléphone pour une capture en hauteur, navigateur sinon. */
export function guessFrame(ratio: number, { element = false } = {}): ImageFrame {
  if (element) return "card";
  return ratio < 0.75 ? "phone" : "browser";
}

export const slideSchema = z.object({
  /** Petit titre en capitales au-dessus du titre (« TON IA EN LOCAL · ÉPISODE 2 »). */
  kicker: z.string().max(SLIDE_LIMITS.kicker, "Kicker trop long").default(""),
  title: z.string().max(SLIDE_LIMITS.title, "Titre de slide trop long").default(""),
  body: z.string().max(SLIDE_LIMITS.body, "Texte de slide trop long").default(""),
  /** Note de source en bas de la slide (« Source : ollama.com, vérifié le 29/10/2026 »). */
  source: z.string().max(SLIDE_LIMITS.source, "Source trop longue").default(""),
  image: slideImageSchema.nullable().default(null),
});
export type Slide = z.infer<typeof slideSchema>;

export const emptySlide = (): Slide => ({ kicker: "", title: "", body: "", source: "", image: null });

/** Slide dont les champs autres que le texte sont facultatifs (anciennes données, propositions de l'IA). */
type SlideLike = Pick<Slide, "title" | "body"> & { kicker?: string; source?: string; image?: SlideImage | null };

export const TEXT_ALIGNS = [
  { id: "left", label: "Gauche" },
  { id: "center", label: "Centre" },
  { id: "right", label: "Droite" },
] as const;

export const VERTICAL_ALIGNS = [
  { id: "top", label: "Haut" },
  { id: "center", label: "Milieu" },
  { id: "bottom", label: "Bas" },
] as const;

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Couleur invalide (format #RRGGBB)");

export const carouselStyleSchema = z.object({
  textColor: hexColor.default(DEFAULT_TEXT_COLOR),
  /** Couleur des titres ; `null` = la même que le texte. */
  titleColor: hexColor.nullable().default(null),
  /** Couleur des mots du titre écrits *entre astérisques* ; `null` = la même que le titre. */
  accentColor: hexColor.nullable().default(null),
  /** Fond des slides sans mockup. */
  background: hexColor.default(BLANK_BACKGROUND),
  align: z.enum(["left", "center", "right"]).default("center"),
  vertical: z.enum(["top", "center", "bottom"]).default("center"),
  /** Marges de la zone de texte, en % de la largeur (gauche, droite) et de la hauteur (haut, bas). */
  marginLeft: z.number().min(0).max(45).default(10),
  marginRight: z.number().min(0).max(45).default(10),
  marginTop: z.number().min(0).max(80).default(15),
  marginBottom: z.number().min(0).max(80).default(15),
  /** Taille des caractères, en % de la largeur de l'image. */
  titleSize: z.number().min(2).max(20).default(8),
  bodySize: z.number().min(1).max(12).default(4.2),
  /** Numéro « 2/6 » en bas à droite. */
  showNumbers: z.boolean().default(false),
  /** Pied de slide en bas à gauche (« @tamarque · nom de la série »). */
  footer: z.string().max(80).default(""),
  /** Points de pagination en bas à droite (point actif allongé, couleur d'accent). */
  pagination: z.boolean().default(false),
  /** Haut du fond en dégradé radial vers `background` ; `null` = fond uni. */
  gradientTop: hexColor.nullable().default(null),
  /** Halos flous sur le fond (1er en haut à gauche, 2e en bas à droite). */
  halos: z.array(hexColor).max(2).default([]),
});
export type CarouselStyle = z.infer<typeof carouselStyleSchema>;

export const DEFAULT_CAROUSEL_STYLE: CarouselStyle = carouselStyleSchema.parse({});

/** Couleurs d'un nouveau carrousel, d'après la charte (couleurs par défaut quand elle n'en propose pas). */
export function brandCarouselColors(
  kit: Pick<BrandKit, "studio">,
): Pick<
  CarouselStyle,
  "textColor" | "titleColor" | "accentColor" | "background" | "gradientTop" | "halos" | "footer" | "pagination"
> {
  const { studio } = kit;
  return {
    textColor: studio.text ?? DEFAULT_TEXT_COLOR,
    titleColor: studio.title,
    accentColor: studio.accent,
    background: studio.background ?? BLANK_BACKGROUND,
    gradientTop: studio.gradientTop,
    halos: studio.halos,
    footer: studio.footer,
    pagination: studio.pagination,
  };
}

/** Style par défaut d'un nouveau carrousel, aux couleurs de la charte. */
export function defaultCarouselStyle(kit: Pick<BrandKit, "studio">): CarouselStyle {
  return { ...DEFAULT_CAROUSEL_STYLE, ...brandCarouselColors(kit) };
}

export function clampSlideCount(count: number) {
  if (!Number.isFinite(count)) return DEFAULT_SLIDE_COUNT;
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, Math.round(count)));
}

/** Ajuste la liste au nombre de slides voulu (ajoute des slides vides ou retire les dernières). */
export function resizeSlides(slides: readonly SlideLike[], count: number): Slide[] {
  const target = clampSlideCount(count);
  const full = slides.map((slide) => ({ ...emptySlide(), ...slide, image: slide.image ?? null }));
  if (full.length >= target) return full.slice(0, target);
  return [...full, ...Array.from({ length: target - full.length }, emptySlide)];
}

export function isSlideEmpty(slide: Pick<Slide, "title" | "body">) {
  return !slide.title.trim() && !slide.body.trim();
}

/** Texte d'une slide proposé par l'IA (kicker et source seulement quand le carrousel en a). */
export type SlideText = { title: string; body: string; kicker?: string; source?: string };

/** Remplace le texte des slides (proposition de l'IA) en gardant leurs images. */
export function withSlideTexts(slides: readonly Slide[], texts: readonly SlideText[]): Slide[] {
  return slides.map((slide, i) => ({
    kicker: texts[i]?.kicker ?? slide.kicker,
    title: texts[i]?.title ?? "",
    body: texts[i]?.body ?? "",
    source: texts[i]?.source ?? slide.source,
    image: slide.image,
  }));
}

/** Rôle d'une slide dans le carrousel (pour l'interface et les consignes de l'IA). */
export function slideRole(index: number, total: number): "cover" | "content" | "end" {
  if (index === 0) return "cover";
  if (total > 2 && index === total - 1) return "end";
  return "content";
}

export const SLIDE_ROLE_LABELS = {
  cover: "Couverture",
  content: "Contenu",
  end: "Dernière slide",
} as const;

/** Lit des données stockées en JSON, en complétant ce qui manque. */
export function parseSlides(raw: unknown): Slide[] {
  const result = z.array(slideSchema).safeParse(raw);
  return result.success && result.data.length ? result.data : [emptySlide()];
}

export function parseCarouselStyle(raw: unknown): CarouselStyle {
  // Anciennes données : une seule marge pour les deux côtés.
  if (raw && typeof raw === "object" && "marginX" in raw && !("marginLeft" in raw)) {
    const { marginX, ...rest } = raw as Record<string, unknown>;
    raw = { ...rest, marginLeft: marginX, marginRight: marginX };
  }
  const result = carouselStyleSchema.safeParse(raw ?? {});
  return result.success ? result.data : DEFAULT_CAROUSEL_STYLE;
}

/* ------------------------------------------------------------------ */
/* Mise en page du texte                                              */
/* ------------------------------------------------------------------ */

/** Polices des slides (familles CSS), graisses et espacement des lettres des titres (en em). */
export type SlideFonts = {
  heading: string;
  headingWeight: number;
  body: string;
  bodyWeight: number;
  titleTracking: number;
};

/** Mots mis en avant dans un titre : `*mot*`. */
const EMPHASIS = /\*/g;

/** Retire les astérisques de mise en avant. */
export function stripEmphasis(text: string) {
  return text.replace(EMPHASIS, "");
}

/**
 * Découpe les lignes d'un titre en morceaux normaux / mis en avant. Une mise
 * en avant peut continuer sur la ligne suivante.
 */
export function emphasisRuns(lines: readonly string[]): { text: string; accent: boolean }[][] {
  let accent = false;
  return lines.map((line) => {
    const runs: { text: string; accent: boolean }[] = [];
    line.split("*").forEach((text, i) => {
      if (i > 0) accent = !accent;
      if (text) runs.push({ text, accent });
    });
    return runs;
  });
}

/** Largeur d'un texte avec une police CSS (ex. `ctx.measureText`). */
export type Measure = (text: string, font: string, letterSpacing?: number) => number;

/** Découpe un texte en lignes qui tiennent dans `maxWidth` (les sauts de ligne sont conservés). */
export function wrapText(
  text: string,
  maxWidth: number,
  font: string,
  measure: Measure,
  letterSpacing = 0,
): string[] {
  const width = (value: string) => measure(value, font, letterSpacing);
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
      // Mot plus large que la zone : coupé lettre par lettre.
      while (width(line) > maxWidth && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && width(line.slice(0, cut)) > maxWidth) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  // Pas de lignes vides en début ou fin de bloc.
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

export type TextBlock = {
  kind: "kicker" | "title" | "body";
  lines: string[];
  font: string;
  size: number;
  lineHeight: number;
  /** Espacement entre les lettres, en px (négatif : resserré, comme les titres du site). */
  letterSpacing: number;
  /** Position verticale du haut du bloc. */
  y: number;
};

export type SlideLayout = {
  blocks: TextBlock[];
  /** Abscisse d'ancrage du texte, selon l'alignement. */
  x: number;
  align: CarouselStyle["align"];
  zone: { left: number; top: number; width: number; height: number };
  /** Le texte a été réduit pour tenir dans la zone. */
  shrunk: boolean;
  /** Le texte dépasse encore de la zone à la taille minimale. */
  overflow: boolean;
};

const TITLE_LINE_HEIGHT = 1.1;
/** Titres resserrés comme sur tamarque.fr (tracking -0,02 à -0,035 em), sauf charte contraire. */
export const DEFAULT_TITLE_TRACKING = -0.025;
const BODY_LINE_HEIGHT = 1.4;
/** Kicker, en part de la largeur de la slide. */
const KICKER_SIZE = 0.0315;
/** Libellé au-dessus d'une image, en part de la largeur de la slide. */
export const IMAGE_LABEL_SIZE = 0.024;
const MIN_SCALE = 0.35;

type Box = { left: number; top: number; width: number; height: number };

/**
 * Cadre d'une image posée sur une slide, en px de la slide (sans la rotation) :
 * boîte extérieure, et zone où l'image est dessinée (relative à la boîte).
 */
export function imageFrameLayout(image: SlideImage, size: { width: number; height: number }) {
  const width = (image.width / 100) * size.width;
  const ratio = image.ratio > 0 ? image.ratio : 1;
  let height: number;
  let content: Box;
  let radius: number;
  /** Hauteur de la barre (navigateur) ou de la barre d'état + barre d'adresse (téléphone). */
  let chrome = 0;
  switch (image.frame) {
    case "browser": {
      chrome = width * 0.05;
      content = { left: 0, top: chrome, width, height: width / ratio };
      height = chrome + content.height;
      radius = width * 0.022;
      break;
    }
    case "phone": {
      const bezel = width * 0.035;
      const screenWidth = width - bezel * 2;
      const screenHeight = screenWidth * 2.16;
      chrome = width * 0.13 + (image.url.trim() ? width * 0.12 : 0);
      content = { left: bezel, top: bezel + chrome, width: screenWidth, height: screenHeight - chrome };
      height = screenHeight + bezel * 2;
      radius = width * 0.16;
      break;
    }
    case "paper": {
      // Capture posée dans une carte blanche, avec une marge blanche autour.
      const pad = width * 0.035;
      content = { left: pad, top: pad, width: width - pad * 2, height: (width - pad * 2) / ratio };
      height = content.height + pad * 2;
      radius = width * 0.028;
      break;
    }
    default: {
      content = { left: 0, top: 0, width, height: width / ratio };
      height = content.height;
      radius = image.frame === "card" ? width * 0.03 : 0;
    }
  }
  const left = (image.x / 100) * size.width - width / 2;
  const top = (image.y / 100) * size.height;
  return { box: { left, top, width, height }, content, radius, chrome };
}

/**
 * Zone de texte d'une slide : celle de la mise en page, réduite à l'espace
 * au-dessus (ou en dessous) de l'image quand elle la recouvre.
 */
export function textZone(style: CarouselStyle, size: { width: number; height: number }, image: SlideImage | null): Box {
  const left = (style.marginLeft / 100) * size.width;
  const top = (style.marginTop / 100) * size.height;
  const zone = {
    left,
    top,
    width: Math.max(1, size.width - left - (style.marginRight / 100) * size.width),
    height: Math.max(1, size.height - top - (style.marginBottom / 100) * size.height),
  };
  if (!image) return zone;
  const frame = imageFrameLayout(image, size).box;
  // Le libellé au-dessus de l'image fait partie de la place qu'elle prend.
  const labelHeight = image.label.trim() ? size.width * IMAGE_LABEL_SIZE * 2 : 0;
  const box = { ...frame, top: frame.top - labelHeight, height: frame.height + labelHeight };
  const gap = size.height * 0.03;
  const overlapsX = box.left < zone.left + zone.width && box.left + box.width > zone.left;
  const overlapsY = box.top < zone.top + zone.height && box.top + box.height > zone.top;
  if (!overlapsX || !overlapsY) return zone;
  const above = box.top - gap - zone.top;
  const below = zone.top + zone.height - (box.top + box.height + gap);
  if (above <= 0 && below <= 0) return zone;
  return above >= below
    ? { ...zone, height: above }
    : { ...zone, top: box.top + box.height + gap, height: below };
}

/** Place le titre et le texte d'une slide dans la zone de texte, en réduisant la taille si besoin. */
export function layoutSlide({
  slide,
  style,
  width,
  height,
  fonts,
  measure,
}: {
  slide: SlideLike;
  style: CarouselStyle;
  width: number;
  height: number;
  fonts: SlideFonts;
  measure: Measure;
}): SlideLayout {
  const zone = textZone(style, { width, height }, slide.image ?? null);
  const { left, top } = zone;
  const x =
    style.align === "left" ? left : style.align === "right" ? left + zone.width : left + zone.width / 2;

  const build = (scale: number) => {
    const parts: Omit<TextBlock, "y">[] = [];
    const kicker = slide.kicker?.trim().toUpperCase() ?? "";
    if (kicker) {
      // Petit titre en capitales espacées (34 px sur une slide de 1080 px).
      const size = width * KICKER_SIZE * scale;
      const font = `${fonts.headingWeight} ${size}px ${fonts.heading}`;
      const letterSpacing = size * 0.08;
      parts.push({
        kind: "kicker",
        font,
        size,
        letterSpacing,
        lineHeight: size * 1.25,
        lines: wrapText(kicker, zone.width, font, measure, letterSpacing),
      });
    }
    const title = slide.title.trim();
    const body = slide.body.trim();
    if (title) {
      const size = (style.titleSize / 100) * width * scale;
      const font = `${fonts.headingWeight} ${size}px ${fonts.heading}`;
      const letterSpacing = size * fonts.titleTracking;
      // Les astérisques de mise en avant ne prennent pas de place.
      const measureTitle: Measure = (text, f, spacing) => measure(stripEmphasis(text), f, spacing);
      parts.push({
        kind: "title",
        font,
        size,
        letterSpacing,
        lineHeight: size * TITLE_LINE_HEIGHT,
        lines: wrapText(title, zone.width, font, measureTitle, letterSpacing),
      });
    }
    if (body) {
      const size = (style.bodySize / 100) * width * scale;
      const font = `${fonts.bodyWeight} ${size}px ${fonts.body}`;
      parts.push({
        kind: "body",
        font,
        size,
        letterSpacing: 0,
        lineHeight: size * BODY_LINE_HEIGHT,
        lines: wrapText(body, zone.width, font, measure),
      });
    }
    // Espace après chaque bloc sauf le dernier : sous le kicker, puis sous le titre.
    const gaps = parts.map((part, i) => (i === parts.length - 1 ? 0 : part.kind === "kicker" ? part.size * 0.7 : part.size * 0.6));
    const total = parts.reduce((sum, p, i) => sum + p.lines.length * p.lineHeight + gaps[i], 0);
    return { parts, gaps, total };
  };

  let scale = 1;
  let built = build(scale);
  while (built.total > zone.height && scale > MIN_SCALE) {
    scale = Math.max(MIN_SCALE, scale * 0.92);
    built = build(scale);
  }

  const start =
    style.vertical === "top"
      ? top
      : style.vertical === "bottom"
        ? top + zone.height - built.total
        : top + (zone.height - built.total) / 2;
  let y = start;
  const blocks = built.parts.map((part, i) => {
    const block = { ...part, y };
    y += part.lines.length * part.lineHeight + built.gaps[i];
    return block;
  });

  return {
    blocks,
    x,
    align: style.align,
    zone,
    shrunk: scale < 1,
    overflow: built.total > zone.height,
  };
}

/**
 * Mise en page adaptée à une zone de texte détectée sur un mockup : marges de
 * la zone, et tailles de caractères proportionnées à sa largeur (≈ 13
 * caractères par ligne de titre, ≈ 26 par ligne de texte).
 */
export function styleForZone(
  margins: Pick<CarouselStyle, "marginLeft" | "marginRight" | "marginTop" | "marginBottom">,
): Partial<CarouselStyle> {
  const zoneWidth = 100 - margins.marginLeft - margins.marginRight;
  const round = (n: number) => Math.round(n * 10) / 10;
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  return {
    ...margins,
    titleSize: round(clamp(zoneWidth / 13 / 0.62, 3, 12)),
    bodySize: round(clamp(zoneWidth / 26 / 0.52, 2, 6)),
  };
}

/**
 * Place disponible dans la zone de texte, en caractères, pour un titre (sur
 * 3 lignes au plus) et pour le texte qui l'accompagne. Sert à guider l'IA et
 * les compteurs des slides.
 */
export function textCapacity(
  style: CarouselStyle,
  size: { width: number; height: number },
  image: SlideImage | null = null,
) {
  const { width: zoneWidth, height: zoneHeight } = textZone(style, size, image);
  const titlePx = (style.titleSize / 100) * size.width;
  const bodyPx = (style.bodySize / 100) * size.width;
  const titlePerLine = zoneWidth / (titlePx * 0.62);
  const bodyPerLine = zoneWidth / (bodyPx * 0.52);
  const titleLines = Math.max(1, Math.min(3, Math.floor(zoneHeight / (titlePx * 1.15))));
  const bodyLines = Math.floor((zoneHeight - titleLines * titlePx * 1.15 - titlePx * 0.6) / (bodyPx * 1.4));
  return {
    title: Math.max(15, Math.round(titlePerLine * titleLines * 0.9)),
    body: Math.max(0, Math.round(bodyPerLine * Math.max(0, bodyLines) * 0.85)),
  };
}

/** Nom de fichier d'une slide exportée : « carrousel-mon-titre-01.png ». */
export function slideFileName(title: string, index: number) {
  const slug =
    title
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "carrousel";
  return `${slug}-${String(index + 1).padStart(2, "0")}.png`;
}
