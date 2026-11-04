import { describe, expect, it } from "vitest";

import { clampNotes, parseResearch, pickSources, researchForPrompt, serializeResearch } from "../ai/research";
import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { buildTaskMessages } from "../ai/tasks";

const research = { notes: "- 62 % des marques utilisent l'UGC (Hubspot)", sources: [{ title: "Hubspot", url: "https://hubspot.fr/ugc" }], at: 1 };

describe("recherches d'un post", () => {
  it("relit ce qui a été enregistré", () => {
    expect(parseResearch(serializeResearch(research))).toEqual(research);
    expect(parseResearch("")).toBeNull();
    expect(parseResearch("{abîmé")).toBeNull();
    expect(serializeResearch({ ...research, notes: "  " })).toBe("");
  });

  it("garde les sources sans doublon, pages lues d'abord", () => {
    const sources = pickSources(
      [{ title: "Lue", url: "https://a.fr/page/" }],
      [{ title: "Trouvée", url: "https://a.fr/page#x" }, { title: "Autre", url: "https://b.fr" }],
    );
    expect(sources.map((s) => s.title)).toEqual(["Lue", "Autre"]);
  });

  it("coupe des notes trop longues", () => {
    expect(clampNotes("ligne\n".repeat(2_000)).length).toBeLessThanOrEqual(4_000);
  });

  it("envoie les notes et leurs sources aux légendes", () => {
    const result = buildTaskMessages(
      "captions",
      { post: { title: "UGC", platforms: ["instagram"], research: researchForPrompt(research) } },
      DEFAULT_AI_SETTINGS.brand,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages[1].content).toContain("# Recherches sur le sujet");
    expect(result.messages[1].content).toContain("https://hubspot.fr/ugc");
  });
});
