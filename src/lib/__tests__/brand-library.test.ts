import { describe, expect, it } from "vitest";

import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { buildSystemPrompt, buildTaskMessages, parseTaskOutput } from "../ai/tasks";
import { DEFAULT_BRAND_KIT, describeBrandKit, parseBrandKit } from "../brand";
import { LUMEN_KIT } from "./fixtures/brand-kits";
import { guessCategory, titleFromFileName } from "../library";
import { DEFAULT_TEMPLATES, parseJsonList } from "../templates";

const brand = { ...DEFAULT_AI_SETTINGS.brand, kit: LUMEN_KIT };

describe("charte", () => {
  it("lit une charte complète", () => {
    expect(LUMEN_KIT.slogan).toBe("Créateurs × Entreprises");
    const main = LUMEN_KIT.palettes[0].colors;
    expect(main.map((c) => c.hex)).toContain("#E96932");
    expect(main.reduce((sum, c) => sum + (c.share ?? 0), 0)).toBe(100);
    expect(LUMEN_KIT.fonts.heading).toBe("Outfit Bold");
  });

  it("revient à la charte par défaut si les données sont invalides", () => {
    expect(parseBrandKit({ palettes: [{ colors: [{ hex: "rouge" }] }] })).toEqual(DEFAULT_BRAND_KIT);
  });

  it("résume la charte pour l'assistant", () => {
    const text = describeBrandKit(LUMEN_KIT);
    expect(text).toContain("Orange chaleureux #E96932");
    expect(text).toContain("20 %");
    expect(text).toContain("Outfit Bold, légèrement resserrés (substitut : Poppins)");
    expect(text).toContain("Dégradé : #F3C65B → #EA7E60 → #8D3C54");
  });
});

describe("prompts avec la charte", () => {
  it("ajoute le slogan et le positionnement à toutes les demandes", () => {
    const prompt = buildSystemPrompt(brand, "{}");
    expect(prompt).toContain("Slogan : Créateurs × Entreprises");
    expect(prompt).toContain("petits créateurs et entreprises");
    expect(prompt).not.toContain("# Charte graphique");
  });

  it("ajoute la charte graphique au brief visuel, adapté au format", () => {
    const result = buildTaskMessages("visualBrief", { post: { title: "Astuce", format: "carousel" } }, brand);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages[0].content).toContain("# Charte graphique");
    expect(result.messages[0].content).toContain("#E96932");
    expect(result.messages[1].content).toContain("brief du carrousel");
  });

  it("lit un brief visuel", () => {
    expect(parseTaskOutput("visualBrief", '{"brief": "IDÉE\\n- test"}')).toEqual({ brief: "IDÉE\n- test" });
  });
});

describe("bibliothèque et modèles", () => {
  it("propose un titre et une catégorie à partir du fichier", () => {
    expect(titleFromFileName("capture_ecran-accueil.png")).toBe("capture ecran accueil");
    expect(guessCategory("video/mp4")).toBe("video");
    expect(guessCategory("image/png")).toBe("photo");
  });

  it("lit les listes JSON des modèles sans planter", () => {
    expect(parseJsonList('["a", 2, "b"]')).toEqual(["a", "b"]);
    expect(parseJsonList("pas du json")).toEqual([]);
  });

  it("fournit des modèles complets", () => {
    for (const t of DEFAULT_TEMPLATES) {
      expect(t.name && t.caption && t.checklist.length).toBeTruthy();
    }
  });
});
