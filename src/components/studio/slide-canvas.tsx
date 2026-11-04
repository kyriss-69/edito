"use client";

import { useEffect, useRef, useState } from "react";

import { useApp } from "@/components/app-provider";

import type { CarouselStyle, Slide } from "@/lib/carousel";
import { cn } from "@/lib/utils";

import {
  drawSlide,
  libraryImageUrl,
  loadMockup,
  loadSlideFonts,
  slideSize,
  type SlideFonts,
  type SlideImages,
} from "./render-slide";

export type SlideAssets = {
  fonts: SlideFonts | null;
  mockup: HTMLImageElement | null;
  /** Captures posées sur les slides. */
  images: SlideImages;
  /** Polices et mockup chargés : les slides peuvent être dessinées. */
  ready: boolean;
  mockupError: boolean;
  size: { width: number; height: number };
};

const NO_IMAGES: SlideImages = new Map();

/** Charge les polices de la charte, le mockup d'un carrousel et les images de ses slides. */
export function useSlideAssets(mockupUrl: string | null, imageIds: readonly number[] = []): SlideAssets {
  const { meta } = useApp();
  const [fonts, setFonts] = useState<SlideFonts | null>(null);
  const [loaded, setLoaded] = useState<{ url: string; image: HTMLImageElement | null } | null>(null);
  const [images, setImages] = useState<SlideImages>(NO_IMAGES);
  const imageKey = [...new Set(imageIds)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    if (!imageKey) return;
    let alive = true;
    const ids = imageKey.split(",").map(Number);
    void Promise.all(
      ids.map((id) => loadMockup(libraryImageUrl(id)).then((img) => [id, img] as const, () => null)),
    ).then((entries) => {
      if (alive) setImages(new Map(entries.filter((e) => e !== null)));
    });
    return () => {
      alive = false;
    };
  }, [imageKey]);

  useEffect(() => {
    let alive = true;
    void loadSlideFonts(meta.brand).then((f) => alive && setFonts(f));
    return () => {
      alive = false;
    };
  }, [meta.brand]);

  useEffect(() => {
    if (!mockupUrl) return;
    let alive = true;
    loadMockup(mockupUrl).then(
      (image) => alive && setLoaded({ url: mockupUrl, image }),
      () => alive && setLoaded({ url: mockupUrl, image: null }),
    );
    return () => {
      alive = false;
    };
  }, [mockupUrl]);

  const current = mockupUrl && loaded?.url === mockupUrl ? loaded : null;
  const mockup = current?.image ?? null;
  return {
    fonts,
    mockup,
    images,
    ready: Boolean(fonts) && (!mockupUrl || Boolean(current)),
    mockupError: Boolean(current && !current.image),
    size: slideSize(mockup),
  };
}

/** Aperçu d'une slide, dessiné comme à l'export. */
export function SlideCanvas({
  assets,
  slide,
  style,
  index,
  total,
  scale = 0.5,
  className,
}: {
  assets: SlideAssets;
  slide: Slide;
  style: CarouselStyle;
  index: number;
  total: number;
  /** Échelle du dessin par rapport à la taille réelle. */
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { fonts, mockup, images, ready, size } = assets;

  useEffect(() => {
    if (!ref.current || !ready || !fonts) return;
    drawSlide(ref.current, { mockup, slide, style, index, total, fonts, images }, scale);
  }, [ready, fonts, mockup, images, slide, style, index, total, scale]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`Slide ${index + 1} sur ${total}`}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
      className={cn("h-auto w-full rounded-md bg-muted", className)}
    />
  );
}
