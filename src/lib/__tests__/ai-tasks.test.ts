import { describe, expect, it } from "vitest";

import {
  activeModel,
  aiSettingsSchema,
  DEFAULT_AI_SETTINGS,
  normalizeBaseUrl,
  parseAiSettings,
} from "../ai/settings";
import { buildSystemPrompt, buildTaskMessages, describePost, parseTaskOutput } from "../ai/tasks";

const brand = DEFAULT_AI_SETTINGS.brand;
const post = {
  title: "Présentation de Lumen",
  notes: "Montrer l'écran d'accueil",
  format: "carousel",
  pillar: "Promo de l'app",
  platforms: ["instagram" as const],
  cta: "Lien en bio",
};

describe("réglages", () => {
  it("complète les réglages manquants avec les valeurs par défaut", () => {
    const settings = parseAiSettings({ model: "ministral", brand: { addressing: "vous" } });
    expect(settings.model).toBe("ministral");
    expect(settings.baseUrl).toBe("http://localhost:1234");
    expect(settings.brand.addressing).toBe("vous");
    expect(settings.brand.name).toBe("");
  });

  it("revient aux valeurs par défaut si les réglages sont invalides", () => {
    expect(parseAiSettings({ temperature: "chaud" })).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("accepte un brief de marque détaillé", () => {
    const result = aiSettingsSchema.safeParse({ brand: { style: "x".repeat(800), audience: "y".repeat(2_500) } });
    expect(result.success).toBe(true);
  });

  it("nomme le champ trop long, en français", () => {
    const result = aiSettingsSchema.safeParse({ brand: { style: "x".repeat(1_001) } });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/^Style d'écriture : 1\s000 caractères maximum\.$/);
  });

  it("normalise l'adresse du serveur", () => {
    expect(normalizeBaseUrl(" http://localhost:1234/v1/ ")).toBe("http://localhost:1234");
  });
});

describe("prompts", () => {
  it("intègre le brief de marque et le tutoiement", () => {
    const prompt = buildSystemPrompt(
      { ...brand, name: "Lumen", description: "Lumen aide les freelances.", avoid: "le mot « disruptif »" },
      "{}",
    );
    expect(prompt).toContain("community manager de Lumen");
    expect(prompt).toContain("Lumen aide les freelances.");
    expect(prompt).toContain("Tutoie");
    expect(prompt).toContain("« disruptif »");
  });

  it("décrit le post avec ses informations utiles", () => {
    const text = describePost(post);
    expect(text).toContain("Carrousel");
    expect(text).toContain("Promo de l'app");
    expect(text).toContain("Lien en bio");
    expect(text).not.toContain("Campagne");
  });

  it("n'envoie pas la mention des idées générées", () => {
    const text = describePost({ ...post, notes: "Accroche : salut\n\n(idée générée par l'assistant)" });
    expect(text).toContain("Accroche : salut");
    expect(text).not.toContain("idée générée");
  });

  it("valide l'entrée d'une tâche", () => {
    const result = buildTaskMessages("rewrite", { post, caption: "", mode: "fun" }, brand);
    expect(result).toEqual({ ok: false, error: "La légende est vide" });
  });

  it("construit les messages de génération d'idées", () => {
    const result = buildTaskMessages(
      "ideas",
      { pillar: "Coulisses", platforms: ["tiktok"], count: 4, existingTitles: ["Idée déjà là"] },
      brand,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.messages[1].content;
    expect(user).toContain("4 idées");
    expect(user).toContain("« Coulisses »");
    expect(user).toContain("- Idée déjà là");
    expect(user).toContain("## TikTok");
    expect(user).not.toContain("## Instagram");
  });

  it("suit les consignes du réseau réglées par la marque", () => {
    const result = buildTaskMessages(
      "adapt",
      { post, caption: "Bonjour", platform: "linkedin" },
      { ...brand, voices: { linkedin: { tone: "Ton maison très sobre", writing: "", hashtags: "", bio: "" } } },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.messages[1].content;
    expect(user).toContain("Ton : Ton maison très sobre");
    // Champ vide : consigne par défaut.
    expect(user).toContain("voir plus");
  });
});

describe("bio", () => {
  it("rappelle la limite de caractères du réseau", () => {
    const result = buildTaskMessages("bio", { platform: "tiktok", handle: "lumen" }, brand);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages[1].content).toContain("80 caractères maximum");
    expect(result.messages[1].content).toContain("@lumen");
  });

  it("lit les bios renvoyées en liste", () => {
    expect(parseTaskOutput("bio", '["Bio A", "Bio B"]')).toEqual({ bios: ["Bio A", "Bio B"] });
  });
});

describe("parseTaskOutput", () => {
  it("lit les légendes, y compris après une réflexion", () => {
    const raw = '[THINK]Je vais proposer…[/THINK]{"captions": ["Un", "Deux", "Trois"]}';
    expect(parseTaskOutput("captions", raw)).toEqual({ captions: ["Un", "Deux", "Trois"] });
  });

  it("accepte une liste renvoyée directement", () => {
    expect(parseTaskOutput("captions", '["Un", "Deux"]')).toEqual({ captions: ["Un", "Deux"] });
  });

  it("normalise les hashtags", () => {
    expect(parseTaskOutput("hashtags", '{"hashtags": ["marketing", "#App", "#app"]}')).toEqual({
      hashtags: ["#marketing", "#App"],
    });
  });

  it("remplace un format inconnu par « image »", () => {
    const raw = '{"ideas": [{"title": "Idée", "format": "reel"}]}';
    expect(parseTaskOutput("ideas", raw)).toEqual({
      ideas: [{ title: "Idée", hook: "", format: "image", angle: "" }],
    });
  });

  it("renvoie null si la réponse est inexploitable", () => {
    expect(parseTaskOutput("rewrite", "Désolé, je ne peux pas.")).toBeNull();
    expect(parseTaskOutput("rewrite", '{"caption": ""}')).toBeNull();
  });
});

describe("réseaux dans les consignes", () => {
  it("cite les réseaux du post en français et leurs limites de hashtags", () => {
    const result = buildTaskMessages(
      "hashtags",
      { post: { ...post, platforms: ["instagram", "youtube", "linkedin"] }, count: 10 },
      brand,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = String(result.messages[1].content);
    expect(text).toContain("Instagram, YouTube et LinkedIn");
    expect(text).toContain("Instagram en accepte au maximum 5 ; YouTube en accepte au maximum 60");
  });
});

describe("fournisseur de l'assistant", () => {
  it("utilise le modèle du fournisseur choisi", () => {
    const settings = { ...DEFAULT_AI_SETTINGS, model: "qwen/qwen3.8-27b", openrouterModel: "qwen/qwen3.8-27b:free" };
    expect(activeModel(settings)).toBe("qwen/qwen3.8-27b");
    expect(activeModel({ ...settings, provider: "openrouter" })).toBe("qwen/qwen3.8-27b:free");
    expect(DEFAULT_AI_SETTINGS.provider).toBe("lmstudio");
  });
});
