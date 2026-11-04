import { describe, expect, it } from "vitest";

import { BRAND_DOC_MAX_CHARS, estimateTokens, isBrandDocName, prepareBrandDoc } from "../ai/brand-doc";
import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { buildSystemPrompt, buildTaskMessages } from "../ai/tasks";

const brand = DEFAULT_AI_SETTINGS.brand;
const doc = "# Lumen\n\n0 % de commission sur les contrats des créateurs.";

describe("document de référence LUMEN.md", () => {
  it("est envoyé comme source de vérité dans le prompt", () => {
    const prompt = buildSystemPrompt({ ...brand, doc }, "{}");
    expect(prompt).toContain("source de vérité");
    expect(prompt).toContain("0 % de commission");
    // Avant les règles d'écriture et le format de réponse.
    expect(prompt.indexOf("0 % de commission")).toBeLessThan(prompt.indexOf("# Règles d'écriture"));
  });

  it("est envoyé avec chaque tâche", () => {
    const inputs = {
      captions: { post: { title: "Test" } },
      hashtags: { post: { title: "Test" } },
      ideas: {},
      bio: { platform: "instagram" },
      visualBrief: { post: { title: "Test" } },
      mediaAnalysis: { post: { title: "Test" }, images: [{ label: "x", dataUrl: "data:image/jpeg;base64,AAAA" }] },
    } as const;
    for (const [task, input] of Object.entries(inputs)) {
      const result = buildTaskMessages(task as keyof typeof inputs, input, { ...brand, doc });
      expect(result.ok, task).toBe(true);
      if (result.ok) expect(result.messages[0].content, task).toContain("0 % de commission");
    }
  });

  it("n'ajoute rien sans document", () => {
    expect(buildSystemPrompt({ ...brand, doc: null }, "{}")).not.toContain("source de vérité");
  });

  it("nettoie le document", () => {
    expect(prepareBrandDoc("﻿# Titre\r\n\r\n\r\n\r\nTexte <!-- note interne -->\n")).toEqual({
      text: "# Titre\n\nTexte",
      truncated: false,
    });
  });

  it("coupe un document trop long", () => {
    const long = Array.from({ length: 2_000 }, (_, i) => `Paragraphe ${i} : ${"x".repeat(30)}`).join("\n\n");
    const { text, truncated } = prepareBrandDoc(long);
    expect(truncated).toBe(true);
    expect(text.length).toBeLessThan(BRAND_DOC_MAX_CHARS + 60);
    expect(text).toMatch(/non transmise …\]$/);
  });

  it("reconnaît le nom du fichier, même avec une extension masquée", () => {
    const isLumenDoc = (name: string) => isBrandDocName(name, "LUMEN.md");
    expect(["LUMEN.md", "lumen.md", "LUMEN.md.txt"].every(isLumenDoc)).toBe(true);
    expect(["LUMEN.txt", "lumen-logo.jpg", "LUMEN.md.bak", "NUIT.md"].some(isLumenDoc)).toBe(false);
    expect(isBrandDocName("nuit.md", "NUIT.md")).toBe(true);
  });

  it("estime les tokens", () => {
    expect(estimateTokens("x".repeat(350))).toBe(100);
  });
});
