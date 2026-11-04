import { describe, expect, it } from "vitest";

import { brandKitSchema } from "@/lib/brand";
import { LUMEN_KIT, NUIT_KIT } from "./fixtures/brand-kits";
import { brandCarouselColors, DEFAULT_CAROUSEL_STYLE, emphasisRuns, stripEmphasis } from "@/lib/carousel";
import { parseFontName, resolveSlideFonts } from "@/lib/slide-fonts";

const readVar = (name: string) => `var(${name})`;

describe("polices des slides", () => {
  it("lit la famille et la graisse d'un nom de police", () => {
    expect(parseFontName("Inter ExtraBold", 700)).toEqual({ family: "Inter", weight: 800 });
    expect(parseFontName("Inter SemiBold", 400)).toEqual({ family: "Inter", weight: 600 });
    expect(parseFontName("Outfit Bold", 400)).toEqual({ family: "Outfit", weight: 700 });
    expect(parseFontName("Plus Jakarta Sans Regular", 700)).toEqual({ family: "Plus Jakarta Sans", weight: 400 });
    expect(parseFontName("Inter Tight 600", 400)).toEqual({ family: "Inter Tight", weight: 600 });
    expect(parseFontName("Menlo", 400)).toEqual({ family: "Menlo", weight: 400 });
  });

  it("garde les polices de Lumen", () => {
    const fonts = resolveSlideFonts(LUMEN_KIT, readVar);
    expect(fonts).toMatchObject({ headingWeight: 700, bodyWeight: 400, titleTracking: -0.025 });
    expect(fonts.heading).toMatch(/^var\(--font-slide-outfit\), "Poppins"/);
    expect(fonts.body).toMatch(/^var\(--font-slide-jakarta\), var\(--font-slide-inter\)/);
  });

  it("suit la charte Nuit (Inter, titres serrés)", () => {
    const fonts = resolveSlideFonts(NUIT_KIT, readVar);
    expect(fonts).toEqual({
      heading: "var(--font-slide-inter), var(--font-slide-inter-tight), sans-serif",
      headingWeight: 800,
      body: "var(--font-slide-inter), system-ui, sans-serif",
      bodyWeight: 600,
      titleTracking: -0.04,
    });
  });

  it("cherche une police non fournie parmi celles de l'ordinateur", () => {
    const kit = { ...LUMEN_KIT, fonts: { heading: "Menlo", headingFallback: "", body: "", bodyFallback: "" } };
    expect(resolveSlideFonts(kit, readVar).heading).toBe('"Menlo", sans-serif');
    expect(resolveSlideFonts(kit, readVar).body).toBe("var(--font-slide-jakarta), sans-serif");
  });
});

describe("couleurs et mise en avant", () => {
  it("garde les couleurs de Lumen, même sans réglage Studio dans la charte", () => {
    const kit = brandKitSchema.parse({ ...LUMEN_KIT, studio: {} });
    expect(brandCarouselColors(kit)).toMatchObject({
      textColor: DEFAULT_CAROUSEL_STYLE.textColor,
      titleColor: null,
      background: DEFAULT_CAROUSEL_STYLE.background,
    });
  });

  it("propose le fond nuit et l'accent lime de Nuit", () => {
    expect(brandCarouselColors(NUIT_KIT)).toEqual({
      textColor: "#A3A3C2",
      titleColor: "#FFFFFF",
      accentColor: "#C8FF3D",
      background: "#0A0A12",
      gradientTop: "#17142E",
      halos: ["#7C5CFF", "#C8FF3D"],
      footer: "@nuit · Ton IA en local",
      pagination: true,
    });
  });

  it("découpe un titre en mots normaux et mis en avant, sur plusieurs lignes", () => {
    expect(stripEmphasis("Ton *IA en* local")).toBe("Ton IA en local");
    expect(emphasisRuns(["Ton *IA", "en* local"])).toEqual([
      [
        { text: "Ton ", accent: false },
        { text: "IA", accent: true },
      ],
      [
        { text: "en", accent: true },
        { text: " local", accent: false },
      ],
    ]);
  });
});
