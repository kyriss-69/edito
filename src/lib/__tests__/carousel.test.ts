import { describe, expect, it } from "vitest";

import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { buildTaskMessages, parseTaskOutput } from "../ai/tasks";
import { detectFreeZone } from "../mockup-zone";
import {
  clampSlideCount,
  DEFAULT_CAROUSEL_STYLE,
  guessFrame,
  imageFrameLayout,
  layoutSlide,
  parseCarouselStyle,
  parseSlides,
  resizeSlides,
  slideFileName,
  slideImageSchema,
  slideRole,
  styleForZone,
  textCapacity,
  textZone,
  withSlideTexts,
  wrapText,
  type Measure,
} from "../carousel";

/** Mesure factice : chaque caractère fait la moitié de la taille de police. */
const measure: Measure = (text, font) => text.length * Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10) * 0.5;
const fonts = { heading: "Outfit", headingWeight: 700, body: "Plus Jakarta Sans", bodyWeight: 400, titleTracking: -0.025 };

describe("slides", () => {
  it("ajuste le nombre de slides", () => {
    const slides = [{ kicker: "", title: "A", body: "", source: "", image: null }];
    const empty = { kicker: "", title: "", body: "", source: "", image: null };
    expect(resizeSlides(slides, 3)).toEqual([slides[0], empty, empty]);
    expect(resizeSlides(resizeSlides(slides, 3), 1)).toEqual(slides);
    // Anciennes données, sans image, kicker ni source.
    expect(resizeSlides([{ title: "B", body: "" }], 1)).toEqual([{ ...empty, title: "B" }]);
    expect(clampSlideCount(50)).toBe(20);
    expect(clampSlideCount(0)).toBe(1);
  });

  it("donne le rôle de chaque slide", () => {
    expect([0, 1, 2, 3].map((i) => slideRole(i, 4))).toEqual(["cover", "content", "content", "end"]);
    expect(slideRole(1, 2)).toBe("content");
  });

  it("lit les données stockées avec la couleur #3B211B par défaut", () => {
    const empty = { kicker: "", title: "", body: "", source: "", image: null };
    expect(parseSlides("x")).toEqual([empty]);
    expect(parseSlides([{ title: "A" }])).toEqual([{ ...empty, title: "A" }]);
    expect(parseCarouselStyle({}).textColor).toBe("#3B211B");
    expect(parseCarouselStyle({ textColor: "rouge" })).toEqual(DEFAULT_CAROUSEL_STYLE);
    // Titre de la même couleur que le texte, sauf choix contraire.
    expect(DEFAULT_CAROUSEL_STYLE.titleColor).toBeNull();
    expect(parseCarouselStyle({ titleColor: "#E96932" }).titleColor).toBe("#E96932");
  });

  it("nomme les fichiers exportés", () => {
    expect(slideFileName("4 façons d'être vu !", 0)).toBe("4-facons-d-etre-vu-01.png");
    expect(slideFileName("", 11)).toBe("carrousel-12.png");
  });
});

describe("wrapText", () => {
  it("découpe aux espaces et garde les sauts de ligne", () => {
    // 10px → 5px par caractère, 50px = 10 caractères par ligne.
    expect(wrapText("un deux trois quatre", 50, "10px x", measure)).toEqual(["un deux", "trois", "quatre"]);
    expect(wrapText("ligne 1\nligne 2", 500, "10px x", measure)).toEqual(["ligne 1", "ligne 2"]);
  });

  it("coupe un mot trop long", () => {
    expect(wrapText("abcdefghijkl", 25, "10px x", measure)).toEqual(["abcde", "fghij", "kl"]);
  });
});

describe("layoutSlide", () => {
  const base = { style: DEFAULT_CAROUSEL_STYLE, width: 1080, height: 1350, fonts, measure };

  it("centre le texte dans la zone", () => {
    const layout = layoutSlide({ ...base, slide: { title: "Titre", body: "Un texte court" } });
    expect(layout.blocks.map((b) => b.kind)).toEqual(["title", "body"]);
    expect(layout.x).toBe(540);
    expect(layout.shrunk).toBe(false);
    const top = layout.blocks[0].y;
    const last = layout.blocks[1];
    const bottom = last.y + last.lines.length * last.lineHeight;
    // Même espace au-dessus et en dessous du texte.
    expect(Math.round(top - layout.zone.top)).toBe(Math.round(layout.zone.top + layout.zone.height - bottom));
  });

  it("réduit un texte trop long pour qu'il tienne", () => {
    const layout = layoutSlide({ ...base, slide: { title: "", body: "mot ".repeat(400) } });
    expect(layout.shrunk).toBe(true);
    const block = layout.blocks[0];
    expect(block.lines.length * block.lineHeight).toBeLessThanOrEqual(layout.zone.height + 0.001);
  });

  it("resserre les lettres des titres et en tient compte pour les retours à la ligne", () => {
    const spaced: Measure = (text, font, letterSpacing = 0) => measure(text, font) + letterSpacing * text.length;
    const layout = layoutSlide({ ...base, measure: spaced, slide: { title: "Titre", body: "Texte" } });
    expect(layout.blocks[0].letterSpacing).toBeLessThan(0);
    expect(layout.blocks[1].letterSpacing).toBe(0);
    // 9 caractères × 5 px = 45 px : coupé sans resserrement, tient en une ligne avec -1 px par lettre.
    expect(wrapText("aaaa aaaa", 40, "10px x", spaced)).toEqual(["aaaa", "aaaa"]);
    expect(wrapText("aaaa aaaa", 40, "10px x", spaced, -1)).toEqual(["aaaa aaaa"]);
  });

  it("place le texte en haut et à gauche", () => {
    const style = { ...DEFAULT_CAROUSEL_STYLE, align: "left" as const, vertical: "top" as const };
    const layout = layoutSlide({ ...base, style, slide: { title: "Titre", body: "" } });
    expect(layout.x).toBe(108);
    expect(layout.blocks[0].y).toBe(layout.zone.top);
  });
});

describe("zone libre du mockup", () => {
  /** Image 40×40 : fond crème, bande décorative en haut (logo) et bloc à gauche. */
  function mockup() {
    const size = 40;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const decor = y < 8 || (x < 6 && y > 20);
        data.set(decor ? [233, 105, 50, 255] : [255, 241, 223, 255], (y * size + x) * 4);
      }
    }
    return { width: size, height: size, data };
  }

  it("trouve l'espace libre en évitant les décorations", () => {
    const zone = detectFreeZone(mockup());
    expect(zone).not.toBeNull();
    if (!zone) return;
    // Sous la bande du haut (8/40 = 20 %), avec une marge de sécurité.
    expect(zone.marginTop).toBeGreaterThan(20);
    // Centrée : marges gauche et droite égales, à l'écart du bloc de gauche (6/40 = 15 %).
    expect(zone.marginLeft).toBe(zone.marginRight);
    expect(zone.marginLeft).toBeGreaterThan(15);
  });

  it("renonce si l'image n'a pas d'espace libre", () => {
    const size = 20;
    const data = new Uint8ClampedArray(size * size * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 256));
    expect(detectFreeZone({ width: size, height: size, data })).toBeNull();
  });

  it("adapte la taille des caractères à la largeur de la zone", () => {
    const narrow = styleForZone({ marginLeft: 30, marginRight: 30, marginTop: 20, marginBottom: 30 });
    const wide = styleForZone({ marginLeft: 10, marginRight: 10, marginTop: 20, marginBottom: 30 });
    expect(narrow.titleSize).toBeLessThan(wide.titleSize!);
    expect(narrow.marginLeft).toBe(30);
  });

  it("calcule la place disponible pour l'IA", () => {
    const style = { ...DEFAULT_CAROUSEL_STYLE, ...styleForZone({ marginLeft: 28.6, marginRight: 28.6, marginTop: 20.8, marginBottom: 30.1 }) };
    const capacity = textCapacity(style, { width: 1254, height: 1254 });
    expect(capacity.title).toBeGreaterThan(20);
    expect(capacity.title).toBeLessThan(60);
    expect(capacity.body).toBeGreaterThan(80);
    expect(capacity.body).toBeLessThan(400);
  });

  it("reprend les anciennes marges", () => {
    expect(parseCarouselStyle({ marginX: 12 })).toMatchObject({ marginLeft: 12, marginRight: 12 });
  });
});

describe("IA du studio", () => {
  const brand = DEFAULT_AI_SETTINGS.brand;
  const context = {
    title: "Engagement",
    description: "Montrer aux micro-créateurs que l'engagement compte plus que les abonnés.",
    slides: [
      { title: "Tes abonnés ne font pas tout", body: "" },
      { title: "", body: "" },
      { title: "", body: "" },
    ],
  };

  it("rédige tout le carrousel à partir de la description", () => {
    const result = buildTaskMessages("carouselSlides", context, brand);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.messages[1].content as string;
    expect(user).toContain("l'engagement compte plus que les abonnés");
    expect(user).toContain("Rédige les 3 slides");
    expect(user).toContain("Slide 1 (couverture : l'accroche) : titre : « Tes abonnés ne font pas tout »");
    expect(user).toContain("Slide 3 (dernière slide : l'appel à l'action) : vide");
    expect(user).not.toContain("caractères maximum (espaces compris)");
  });

  it("demande kicker, source et mots en accent selon la mise en page", () => {
    const plain = buildTaskMessages("carouselSlides", context, brand);
    const look = buildTaskMessages("carouselSlides", { ...context, look: { kickers: true, accent: true } }, brand);
    expect(plain.ok && look.ok).toBe(true);
    if (!plain.ok || !look.ok) return;
    expect(plain.messages[1].content).not.toContain("« kicker »");
    const user = look.messages[1].content as string;
    expect(user).toContain("« kicker »");
    expect(user).toContain("Aucune source inventée");
    expect(user).toContain("*comme ça*");
    expect(look.messages[0].content).toContain('"kicker": "…"');
    expect(
      parseTaskOutput("carouselSlides", '{"slides": [{"kicker": "La règle", "title": "*8 Go*", "body": "", "source": "ollama.com"}]}'),
    ).toEqual({ slides: [{ kicker: "La règle", title: "*8 Go*", body: "", source: "ollama.com", screen: null }] });
  });

  it("ajoute les guides de la marque aux consignes", () => {
    const result = buildTaskMessages("carouselSlides", context, { ...brand, guides: "R1. Source primaire obligatoire." });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages[0].content).toContain("R1. Source primaire obligatoire.");
  });

  it("indique la place disponible dans l'encadré du mockup", () => {
    const result = buildTaskMessages("carouselSlides", { ...context, capacity: { title: 38, body: 160 } }, brand);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages[1].content).toContain("titre de 38 caractères maximum");
  });

  it("propose des versions d'une slide", () => {
    const result = buildTaskMessages("carouselSlide", { ...context, index: 1 }, brand);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages[1].content).toContain("Propose 3 versions de la slide 2");
  });

  it("exige une description et une slide existante", () => {
    expect(buildTaskMessages("carouselSlides", { ...context, description: " " }, brand).ok).toBe(false);
    expect(buildTaskMessages("carouselSlide", { ...context, index: 3 }, brand)).toEqual({
      ok: false,
      error: "Slide inconnue",
    });
  });

  it("lit les réponses", () => {
    expect(parseTaskOutput("carouselSlides", '[{"title": "A"}, {"body": "B"}]')).toEqual({
      slides: [
        { title: "A", body: "", screen: null },
        { title: "", body: "B", screen: null },
      ],
    });
    expect(parseTaskOutput("carouselSlide", '{"proposals": [{"title": "X", "body": "Y"}]}')).toEqual({
      proposals: [{ title: "X", body: "Y", screen: null }],
    });
  });

  it("lit l'écran de l'app choisi pour une slide", () => {
    const result = parseTaskOutput(
      "carouselSlides",
      '{"slides": [{"title": "A", "screen": 12}, {"title": "B", "screen": "21"}, {"title": "C", "screen": "aucun"}]}',
    );
    expect(result?.slides.map((s) => s.screen)).toEqual([12, 21, null]);
  });
});

describe("images des slides", () => {
  const size = { width: 1000, height: 1250 };
  const image = slideImageSchema.parse({ assetId: 1, ratio: 1.6, frame: "browser", y: 60 });

  it("calcule le cadre du navigateur (barre + capture)", () => {
    const { box, content, chrome } = imageFrameLayout(image, size);
    expect(box.width).toBeCloseTo(680);
    expect(box.left).toBeCloseTo(160);
    expect(box.top).toBeCloseTo(750);
    expect(chrome).toBeCloseTo(34);
    expect(content.height).toBeCloseTo(425);
    expect(box.height).toBeCloseTo(459);
  });

  it("donne au téléphone la forme d'un écran de smartphone", () => {
    const phone = imageFrameLayout({ ...image, frame: "phone", width: 30, url: "lumen.fr" }, size);
    expect(phone.box.height / phone.box.width).toBeGreaterThan(2);
    expect(phone.content.top).toBeGreaterThan(phone.chrome);
  });

  it("place le texte au-dessus de l'image", () => {
    const style = parseCarouselStyle({ marginTop: 30, marginBottom: 5 });
    const zone = textZone(style, size, image);
    expect(zone.top).toBeCloseTo(375);
    expect(zone.top + zone.height).toBeCloseTo(750 - 1250 * 0.03);
    // Sans image : toute la zone.
    expect(textZone(style, size, null).height).toBeCloseTo(1250 * 0.65);
  });

  it("garde l'image en remplaçant le texte des slides", () => {
    const slides = [
      { kicker: "K", title: "A", body: "a", source: "S", image },
      { kicker: "", title: "B", body: "", source: "", image: null },
    ];
    expect(withSlideTexts(slides, [{ title: "X", body: "x" }])).toEqual([
      { kicker: "K", title: "X", body: "x", source: "S", image },
      { kicker: "", title: "", body: "", source: "", image: null },
    ]);
    expect(withSlideTexts(slides, [{ kicker: "NOUVEAU", title: "X", body: "x", source: "" }])[0]).toMatchObject({
      kicker: "NOUVEAU",
      source: "",
    });
  });

  it("choisit un cadre selon la forme de la capture", () => {
    expect(guessFrame(0.49)).toBe("phone");
    expect(guessFrame(1.6)).toBe("browser");
    expect(guessFrame(1.6, { element: true })).toBe("card");
  });
});
