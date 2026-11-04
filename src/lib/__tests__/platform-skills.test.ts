import { describe, expect, it } from "vitest";

import { platformSkillsPrompt, prepareSkill, truncateSkill } from "../ai/platform-skills";
import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { buildSystemPrompt, buildTaskMessages } from "../ai/tasks";

const brand = { ...DEFAULT_AI_SETTINGS.brand, doc: "Lumen met en relation marques et créateurs." };
const post = { title: "Tendances UGC", platforms: ["linkedin" as const] };

describe("skills par réseau", () => {
  it("nettoie un guide : en-tête, scripts et section demandée", () => {
    const raw = "---\nname: x\n---\n# Titre\n\n```bash\npython3 caption.py\n```\n\n## LinkedIn\nConseil A\n\n## X\nConseil B";
    expect(prepareSkill(raw)).not.toContain("python3");
    expect(prepareSkill(raw)).not.toContain("name: x");
    expect(prepareSkill(raw, "LinkedIn")).toBe("## LinkedIn\nConseil A");
    expect(prepareSkill(raw, "Inconnu")).toBe("");
  });

  it("coupe un guide trop long", () => {
    const text = truncateSkill("a".repeat(5_000), 1_000);
    expect(text.length).toBeLessThan(1_100);
    expect(text).toContain("non transmise");
  });

  it("n'envoie que le guide des réseaux demandés", () => {
    const skills = { linkedin: { caption: "Guide LI" }, x: { caption: "Guide X" } };
    const text = platformSkillsPrompt(["linkedin"], skills, "caption");
    expect(text).toContain("Guide LI");
    expect(text).not.toContain("Guide X");
    expect(platformSkillsPrompt(["instagram"], skills, "caption")).toBe("");
  });

  it("ajoute le guide aux messages d'adaptation", () => {
    const result = buildTaskMessages(
      "adapt",
      { post, caption: "Bonjour", platform: "linkedin" },
      { ...brand, skills: { linkedin: { caption: "Hook in two lines" } } },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages[1].content).toContain("Hook in two lines");
  });
});

describe("liberté de rédaction", () => {
  it("ouverte par défaut : connaissances générales sur le sujet", () => {
    expect(buildSystemPrompt(brand, null)).toContain("connaissances générales");
  });

  it("stricte : s'en tient au document", () => {
    const prompt = buildSystemPrompt(brand, null, { mode: "strict" });
    expect(prompt).toContain("n'avance aucun fait qui n'y figure pas");
    expect(prompt).not.toContain("connaissances générales");
  });

  it("suit le réglage du post", () => {
    const result = buildTaskMessages("captions", { post: { ...post, aiMode: "strict" } }, brand);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.messages[0].content).toContain("Reste centré sur la marque");
  });
});
