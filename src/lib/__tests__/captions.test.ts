import { describe, expect, it } from "vitest";

import {
  checkCaption,
  composeCaption,
  extractHashtags,
  normalizeHashtags,
} from "../captions";

describe("normalizeHashtags", () => {
  it("ajoute les # et supprime les doublons", () => {
    expect(normalizeHashtags("marketing, #App  app ##Lumen")).toBe(
      "#marketing #App #Lumen",
    );
  });

  it("renvoie une chaîne vide pour une saisie vide", () => {
    expect(normalizeHashtags("  , ")).toBe("");
  });
});

describe("composeCaption", () => {
  it("sépare légende et hashtags par une ligne vide", () => {
    expect(composeCaption("Bonjour", "#a #b")).toBe("Bonjour\n\n#a #b");
  });

  it("gère les parties vides", () => {
    expect(composeCaption("", "#a")).toBe("#a");
    expect(composeCaption("Texte ", "")).toBe("Texte");
  });
});

describe("checkCaption", () => {
  it("compte les emojis comme un seul caractère", () => {
    expect(checkCaption("instagram", "🚀🚀", "").length).toBe(2);
  });

  it("détecte le dépassement de hashtags sur Instagram", () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ");
    const result = checkCaption("instagram", "Hello", tags);
    expect(result.hashtagCount).toBe(31);
    expect(result.tooManyHashtags).toBe(true);
  });

  it("n'impose pas de limite de hashtags sur TikTok", () => {
    const tags = Array.from({ length: 50 }, (_, i) => `#t${i}`).join(" ");
    expect(checkCaption("tiktok", "", tags).tooManyHashtags).toBe(false);
  });

  it("détecte une légende trop longue", () => {
    expect(checkCaption("instagram", "a".repeat(2201), "").tooLong).toBe(true);
    expect(checkCaption("tiktok", "a".repeat(2201), "").tooLong).toBe(false);
  });

  it("extrait les hashtags accentués", () => {
    expect(extractHashtags("Salut #réseaux et #app_2")).toEqual([
      "#réseaux",
      "#app_2",
    ]);
  });
});
