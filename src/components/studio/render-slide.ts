"use client";

import type { BrandKit } from "@/lib/brand";
import {
  DEFAULT_SLIDE_SIZE,
  emphasisRuns,
  IMAGE_LABEL_SIZE,
  imageFrameLayout,
  layoutSlide,
  type CarouselStyle,
  type Slide,
  type SlideFonts,
  type SlideImage,
  type SlideLayout,
  styleForZone,
} from "@/lib/carousel";
import { libraryImageUrl } from "@/lib/library";
import { detectFreeZone } from "@/lib/mockup-zone";
import { resolveSlideFonts } from "@/lib/slide-fonts";

export type { SlideFonts };

/** Polices de la charte, chargées une fois par jeu de polices. */
const fontsPromises = new Map<string, Promise<SlideFonts>>();

export function loadSlideFonts(kit: Pick<BrandKit, "fonts" | "studio">) {
  const key = JSON.stringify([kit.fonts, kit.studio.titleTracking]);
  let promise = fontsPromises.get(key);
  if (!promise) {
    promise = (async () => {
      const css = getComputedStyle(document.documentElement);
      const fonts = resolveSlideFonts(kit, (name) => css.getPropertyValue(name));
      await Promise.all([
        document.fonts.load(`${fonts.headingWeight} 40px ${fonts.heading}`, "Aàé"),
        document.fonts.load(`${fonts.bodyWeight} 40px ${fonts.body}`, "Aàé"),
      ]).catch(() => undefined);
      return fonts;
    })();
    fontsPromises.set(key, promise);
  }
  return promise;
}

const images = new Map<string, Promise<HTMLImageElement>>();

/** Charge (une seule fois) une image : mockup ou capture posée sur une slide. */
export function loadMockup(url: string) {
  let promise = images.get(url);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
    promise.catch(() => images.delete(url));
    images.set(url, promise);
  }
  return promise;
}

/** Images des slides, par identifiant de la bibliothèque. */
export type SlideImages = ReadonlyMap<number, HTMLImageElement>;

export { libraryImageUrl };

/** Charge les images posées sur les slides (celles qui manquent sont ignorées). */
export async function loadSlideImages(slides: readonly Slide[]): Promise<Map<number, HTMLImageElement>> {
  const ids = [...new Set(slides.flatMap((s) => (s.image ? [s.image.assetId] : [])))];
  const loaded = await Promise.all(
    ids.map((id) => loadMockup(libraryImageUrl(id)).then((img) => [id, img] as const, () => null)),
  );
  return new Map(loaded.filter((entry) => entry !== null));
}

/** Taille réelle d'une slide : celle du mockup, ou 1080 × 1350 sans mockup. */
export function slideSize(mockup: HTMLImageElement | null) {
  return {
    width: mockup?.naturalWidth || DEFAULT_SLIDE_SIZE.width,
    height: mockup?.naturalHeight || DEFAULT_SLIDE_SIZE.height,
  };
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Mise en page d'une slide sans la dessiner (pour signaler un texte réduit ou trop long). */
export function computeSlideLayout(
  slide: Slide,
  style: CarouselStyle,
  size: { width: number; height: number },
  fonts: SlideFonts,
): SlideLayout {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx;
  const measure = (text: string, font: string, letterSpacing = 0) => {
    if (!ctx) return text.length * 10;
    return measureWith(ctx, text, font, letterSpacing);
  };
  return layoutSlide({ slide, style, ...size, fonts, measure });
}

/** Le canvas sait espacer les lettres (navigateurs récents). */
const canvasLetterSpacing =
  typeof CanvasRenderingContext2D !== "undefined" && "letterSpacing" in CanvasRenderingContext2D.prototype;

/** Largeur d'un texte, espacement des lettres compris. */
function measureWith(ctx: CanvasRenderingContext2D, text: string, font: string, letterSpacing: number) {
  ctx.font = font;
  if (canvasLetterSpacing) {
    ctx.letterSpacing = `${letterSpacing}px`;
    return ctx.measureText(text).width;
  }
  return ctx.measureText(text).width;
}

/**
 * Dessine une slide et renvoie la mise en page utilisée. La mise en page est
 * calculée à la taille réelle, puis dessinée à l'échelle `scale` (aperçus
 * légers, rendu identique à l'export).
 */
export function drawSlide(
  canvas: HTMLCanvasElement,
  {
    mockup,
    slide,
    style,
    index,
    total,
    fonts,
    images,
  }: {
    mockup: HTMLImageElement | null;
    slide: Slide;
    style: CarouselStyle;
    index: number;
    total: number;
    fonts: SlideFonts;
    images?: SlideImages;
  },
  scale = 1,
): SlideLayout {
  const { width, height } = slideSize(mockup);
  const pixelWidth = Math.max(1, Math.round(width * scale));
  const pixelHeight = Math.max(1, Math.round(height * scale));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (mockup) {
    ctx.drawImage(mockup, 0, 0, width, height);
  } else {
    drawBackground(ctx, style, { width, height });
  }

  const titleColor = style.titleColor ?? style.textColor;
  const accent = style.accentColor ?? titleColor;
  if (slide.image) {
    drawFrame(ctx, slide.image, images?.get(slide.image.assetId) ?? null, { width, height }, fonts, style.textColor);
  }

  const measure = (text: string, font: string, letterSpacing = 0) =>
    measureWith(ctx, text, font, letterSpacing);
  const layout = layoutSlide({ slide, style, width, height, fonts, measure });

  ctx.textAlign = layout.align;
  ctx.textBaseline = "middle";
  for (const block of layout.blocks) {
    ctx.fillStyle = block.kind === "kicker" ? accent : block.kind === "title" ? titleColor : style.textColor;
    ctx.font = block.font;
    if (canvasLetterSpacing) ctx.letterSpacing = `${block.letterSpacing}px`;
    const runs = block.kind === "title" ? emphasisRuns(block.lines) : null;
    block.lines.forEach((line, i) => {
      const y = block.y + i * block.lineHeight + block.lineHeight / 2;
      if (!runs || !runs[i].some((run) => run.accent)) {
        ctx.textAlign = layout.align;
        ctx.fillText(runs ? runs[i].map((run) => run.text).join("") : line, layout.x, y);
        return;
      }
      // Mots mis en avant : morceau par morceau, à la couleur d'accent.
      const widths = runs[i].map((run) => ctx.measureText(run.text).width);
      const lineWidth = widths.reduce((sum, w) => sum + w, 0);
      let x = layout.align === "left" ? layout.x : layout.align === "right" ? layout.x - lineWidth : layout.x - lineWidth / 2;
      ctx.textAlign = "left";
      runs[i].forEach((run, j) => {
        ctx.fillStyle = run.accent ? accent : titleColor;
        ctx.fillText(run.text, x, y);
        x += widths[j];
      });
    });
  }

  if (canvasLetterSpacing) ctx.letterSpacing = "0px";
  drawFooter(ctx, { slide, style, index, total, fonts, accent }, { width, height });
  if (style.showNumbers && !style.pagination && total > 1) {
    ctx.fillStyle = style.textColor;
    const size = width * 0.03;
    ctx.font = `400 ${size}px ${fonts.body}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 0.7;
    ctx.fillText(`${index + 1}/${total}`, width - width * 0.05, height - height * 0.04);
    ctx.globalAlpha = 1;
  }
  return layout;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Dessine l'image à la place de la zone, en la recadrant (haut de l'image gardé). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  area: { left: number; top: number; width: number; height: number },
) {
  const scale = area.width / img.naturalWidth;
  const sourceHeight = Math.min(img.naturalHeight, area.height / scale);
  ctx.drawImage(img, 0, 0, img.naturalWidth, sourceHeight, area.left, area.top, area.width, sourceHeight * scale);
}

/** Emplacement de l'image tant qu'elle n'est pas chargée (ou introuvable). */
function drawPlaceholder(ctx: CanvasRenderingContext2D, area: { left: number; top: number; width: number; height: number }) {
  ctx.fillStyle = "#EDE6DE";
  ctx.fillRect(area.left, area.top, area.width, area.height);
}

/** `#RRGGBB` → `rgba(…)` avec l'opacité voulue. */
function withAlpha(hex: string, alpha: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Fond sans mockup : uni, ou dégradé radial depuis le haut, avec des halos flous. */
function drawBackground(ctx: CanvasRenderingContext2D, style: CarouselStyle, { width, height }: { width: number; height: number }) {
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, width, height);
  if (style.gradientTop) {
    const gradient = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, height * 1.1);
    gradient.addColorStop(0, style.gradientTop);
    gradient.addColorStop(1, style.background);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  // Halos : violet en haut à gauche (18 %), plus discret en bas à droite (6 %).
  const spots = [
    { x: 0.12, y: 0.1, alpha: 0.18 },
    { x: 0.9, y: 0.92, alpha: 0.06 },
  ];
  style.halos.forEach((color, i) => {
    const { x, y, alpha } = spots[i];
    const radius = width * 0.62;
    const halo = ctx.createRadialGradient(x * width, y * height, 0, x * width, y * height, radius);
    halo.addColorStop(0, withAlpha(color, alpha));
    halo.addColorStop(1, withAlpha(color, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);
  });
}

/** Bas de la slide : note de source, pied (« @tamarque · série ») et points de pagination. */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  {
    slide,
    style,
    index,
    total,
    fonts,
    accent,
  }: { slide: Slide; style: CarouselStyle; index: number; total: number; fonts: SlideFonts; accent: string },
  { width, height }: { width: number; height: number },
) {
  const margin = width * 0.078;
  const baseline = height - height * 0.045;
  const footer = style.footer.trim();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const source = slide.source.trim();
  if (source) {
    ctx.fillStyle = withAlpha(style.textColor, 0.75);
    ctx.font = `${fonts.bodyWeight} ${width * 0.021}px ${fonts.body}`;
    const y = footer || style.pagination ? height - height * 0.088 : baseline;
    ctx.fillText(source, margin, y, width - margin * 2);
  }
  if (footer) {
    ctx.fillStyle = withAlpha(style.textColor, 0.9);
    ctx.font = `${fonts.bodyWeight} ${width * 0.024}px ${fonts.body}`;
    ctx.fillText(footer, margin, baseline, width * 0.6);
  }
  if (style.pagination && total > 1) {
    const dot = width * 0.011;
    const gap = dot * 0.9;
    const widths = Array.from({ length: total }, (_, i) => (i === index ? dot * 3 : dot));
    let x = width - margin - widths.reduce((sum, w) => sum + w, 0) - gap * (total - 1);
    widths.forEach((w, i) => {
      ctx.fillStyle = i === index ? accent : withAlpha(style.textColor, 0.35);
      roundRect(ctx, x, baseline - dot / 2, w, dot, dot / 2);
      ctx.fill();
      x += w + gap;
    });
  }
}

const SHADOW = "rgba(59, 33, 27, 0.28)";
const FRAME_TEXT = "#3B211B";

/**
 * Capture d'écran dans un cadre : fenêtre de navigateur (barre et adresse),
 * téléphone (barre d'état, adresse), carte arrondie ou image seule. Le cadre
 * peut dépasser du bord de la slide.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  image: SlideImage,
  img: HTMLImageElement | null,
  size: { width: number; height: number },
  fonts: SlideFonts,
  labelColor: string,
) {
  const { box, content, radius, chrome } = imageFrameLayout(image, size);
  const { width: w, height: h } = box;
  const url = image.url.trim();
  const area = (a: typeof content) => ({ left: a.left, top: a.top, width: a.width, height: a.height });

  ctx.save();
  ctx.translate(box.left + w / 2, box.top + h / 2);
  ctx.rotate((image.rotation * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);

  const shadow = (on: boolean) => {
    ctx.shadowColor = on ? SHADOW : "transparent";
    ctx.shadowBlur = on ? w * 0.06 : 0;
    ctx.shadowOffsetY = on ? w * 0.02 : 0;
  };

  // Libellé au-dessus du cadre : d'où vient la capture.
  const label = image.label.trim().toUpperCase();
  if (label) {
    const labelSize = size.width * IMAGE_LABEL_SIZE;
    ctx.fillStyle = labelColor;
    ctx.font = `${fonts.headingWeight} ${labelSize}px ${fonts.heading}`;
    if (canvasLetterSpacing) ctx.letterSpacing = `${labelSize * 0.08}px`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(label, 0, -labelSize * 0.7, size.width * 0.9);
    if (canvasLetterSpacing) ctx.letterSpacing = "0px";
  }

  if (image.frame === "browser") {
    shadow(true);
    ctx.fillStyle = "#F7F2EC";
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fill();
    shadow(false);
    // Barre de la fenêtre : trois pastilles et l'adresse.
    const dot = chrome * 0.13;
    ["#FF5F57", "#FEBC2E", "#28C840"].forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(chrome * 0.62 + i * chrome * 0.48, chrome / 2, dot, 0, Math.PI * 2);
      ctx.fill();
    });
    const pillLeft = chrome * 2.2;
    const pillHeight = chrome * 0.58;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, pillLeft, (chrome - pillHeight) / 2, w * 0.58 - pillLeft, pillHeight, pillHeight / 2);
    ctx.fill();
    if (url) {
      ctx.fillStyle = FRAME_TEXT;
      ctx.font = `500 ${chrome * 0.32}px ${fonts.body}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(url, pillLeft + pillHeight * 0.6, chrome / 2, w * 0.58 - pillLeft - pillHeight);
    }
    ctx.save();
    roundRect(ctx, 0, chrome, w, content.height, [0, 0, radius, radius]);
    ctx.clip();
    if (img) ctx.drawImage(img, 0, chrome, w, content.height);
    else drawPlaceholder(ctx, area(content));
    ctx.restore();
  } else if (image.frame === "phone") {
    const bezel = content.left;
    const screen = { left: bezel, top: bezel, width: w - bezel * 2, height: h - bezel * 2 };
    shadow(true);
    ctx.fillStyle = "#1C1A19";
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fill();
    shadow(false);
    ctx.save();
    roundRect(ctx, screen.left, screen.top, screen.width, screen.height, radius - bezel);
    ctx.clip();
    ctx.fillStyle = "#FBF7F2";
    ctx.fillRect(screen.left, screen.top, screen.width, screen.height);
    if (img) drawCover(ctx, img, area(content));
    else drawPlaceholder(ctx, area(content));
    // Barre d'état : heure, encoche, réseau et batterie.
    const status = w * 0.13;
    ctx.fillStyle = "#FBF7F2";
    ctx.fillRect(screen.left, screen.top, screen.width, chrome);
    ctx.fillStyle = "#111111";
    ctx.font = `600 ${w * 0.05}px ${fonts.body}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("9:41", screen.left + w * 0.1, screen.top + status * 0.5);
    roundRect(ctx, w / 2 - w * 0.15, screen.top + status * 0.2, w * 0.3, status * 0.6, status * 0.3);
    ctx.fill();
    const right = screen.left + screen.width - w * 0.1;
    const unit = w * 0.012;
    for (let i = 0; i < 4; i++) {
      const barHeight = unit * (1.2 + i * 0.8);
      ctx.fillRect(right - w * 0.17 + i * unit * 1.6, screen.top + status * 0.5 + unit * 2 - barHeight, unit, barHeight);
    }
    ctx.lineWidth = unit * 0.6;
    ctx.strokeStyle = "#111111";
    roundRect(ctx, right - w * 0.08, screen.top + status * 0.5 - unit * 2, w * 0.08, unit * 4, unit);
    ctx.stroke();
    ctx.fillRect(right - w * 0.07, screen.top + status * 0.5 - unit * 1.2, w * 0.055, unit * 2.4);
    if (url) {
      const barTop = screen.top + status;
      const barHeight = chrome - status;
      const pill = { left: screen.left + w * 0.05, width: screen.width - w * 0.1, height: barHeight * 0.68 };
      ctx.fillStyle = "#EDE7E0";
      roundRect(ctx, pill.left, barTop + (barHeight - pill.height) / 2 - barHeight * 0.08, pill.width, pill.height, pill.height / 2);
      ctx.fill();
      ctx.fillStyle = FRAME_TEXT;
      ctx.font = `600 ${w * 0.042}px ${fonts.body}`;
      ctx.textAlign = "center";
      ctx.fillText(url, w / 2, barTop + barHeight / 2 - barHeight * 0.08, pill.width - w * 0.06);
    }
    ctx.restore();
  } else if (image.frame === "paper") {
    // Carte blanche avec une grande ombre, la capture posée dedans.
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = w * 0.09;
    ctx.shadowOffsetY = w * 0.03;
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.fill();
    shadow(false);
    ctx.save();
    roundRect(ctx, content.left, content.top, content.width, content.height, radius * 0.45);
    ctx.clip();
    if (img) ctx.drawImage(img, content.left, content.top, content.width, content.height);
    else drawPlaceholder(ctx, area(content));
    ctx.restore();
  } else {
    if (image.frame === "card") {
      shadow(true);
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, 0, 0, w, h, radius);
      ctx.fill();
      shadow(false);
    }
    ctx.save();
    roundRect(ctx, 0, 0, w, h, radius);
    ctx.clip();
    if (img) ctx.drawImage(img, 0, 0, w, h);
    else drawPlaceholder(ctx, area(content));
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Zone de texte adaptée au mockup : la zone libre détectée sur l'image (sous
 * le logo, entre les décorations) et des tailles de caractères assorties.
 * `null` si aucune zone libre assez grande n'est trouvée.
 */
export function detectMockupStyle(mockup: HTMLImageElement): Partial<CarouselStyle> | null {
  const { width, height } = slideSize(mockup);
  const gridWidth = 64;
  const gridHeight = Math.max(8, Math.round((gridWidth * height) / width));
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(mockup, 0, 0, gridWidth, gridHeight);
  const zone = detectFreeZone(ctx.getImageData(0, 0, gridWidth, gridHeight));
  return zone && styleForZone(zone);
}

/** Image PNG d'une slide, pour l'export. */
export async function renderSlidePng(options: Parameters<typeof drawSlide>[1]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawSlide(canvas, options);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export impossible"))), "image/png"),
  );
}
