import { describe, expect, it } from "vitest";

import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import {
  findModel,
  fitWithin,
  formatTimecode,
  frameTimes,
  parseModelCapabilities,
  planFrames,
} from "../ai/media";
import { buildTaskMessages, parseTaskOutput, type ChatContentPart } from "../ai/tasks";
import { suggestFormat } from "../platforms";

const brand = DEFAULT_AI_SETTINGS.brand;
const image = (label: string) => ({ label, dataUrl: "data:image/jpeg;base64,AAAA" });

describe("planFrames", () => {
  it("extrait plusieurs images d'une vidéo seule", () => {
    expect(planFrames(["video"])).toEqual([4]);
  });

  it("donne une image par photo et le reste du budget aux vidéos", () => {
    expect(planFrames(["image", "video", "image"])).toEqual([1, 4, 1]);
    expect(planFrames(["video", "video"])).toEqual([3, 3]);
  });

  it("ignore les médias au-delà du budget", () => {
    expect(planFrames(Array(8).fill("image"))).toEqual([1, 1, 1, 1, 1, 1, 0, 0]);
  });
});

describe("images", () => {
  it("répartit les instants sur toute la vidéo", () => {
    expect(frameTimes(20, 4)).toEqual([2.5, 7.5, 12.5, 17.5]);
    expect(frameTimes(Number.NaN, 3)).toEqual([0]);
  });

  it("réduit sans agrandir", () => {
    expect(fitWithin(4000, 3000, 768)).toEqual({ width: 768, height: 576 });
    expect(fitWithin(300, 200, 768)).toEqual({ width: 300, height: 200 });
  });

  it("formate les durées", () => {
    expect(formatTimecode(7.4)).toBe("0:07");
    expect(formatTimecode(75)).toBe("1:15");
  });
});

describe("capacités des modèles", () => {
  it("lit l'API v1 de LM Studio", () => {
    const models = parseModelCapabilities({
      models: [
        {
          type: "llm",
          key: "mistralai/ministral-3-8b",
          capabilities: { vision: true },
          loaded_instances: [{ id: "mistralai/ministral-3-8b", config: { context_length: 8192 } }],
        },
        { type: "llm", key: "qwen3-8b", capabilities: { vision: false }, loaded_instances: [] },
        { type: "embedding", key: "nomic-embed" },
      ],
    });
    expect(findModel(models, "mistralai/ministral-3-8b")).toEqual({
      ids: ["mistralai/ministral-3-8b", "mistralai/ministral-3-8b"],
      vision: true,
      contextLength: 8192,
    });
    expect(findModel(models, "qwen3-8b")?.vision).toBe(false);
    expect(findModel(models, "inconnu")).toBeNull();
  });

  it("lit l'ancienne API v0", () => {
    const models = parseModelCapabilities({
      data: [
        { id: "gemma-3-4b", type: "vlm" },
        { id: "ministral-8b-instruct-2410", type: "llm" },
      ],
    });
    expect(findModel(models, "gemma-3-4b")?.vision).toBe(true);
    expect(findModel(models, "ministral-8b-instruct-2410")?.vision).toBe(false);
  });

  it("ignore une réponse inattendue", () => {
    expect(parseModelCapabilities(null)).toEqual([]);
    expect(parseModelCapabilities({ error: "x" })).toEqual([]);
  });
});

describe("tâche mediaAnalysis", () => {
  const post = { title: "", platforms: ["instagram" as const], hashtags: "#lumen" };

  it("envoie chaque image précédée de sa légende", () => {
    const result = buildTaskMessages(
      "mediaAnalysis",
      { post, images: [image("Média 1 — photo (couverture)"), image("Média 2 — vidéo, image à 0:04")], hasVideo: true },
      brand,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const content = result.messages[1].content as ChatContentPart[];
    expect(content.map((part) => part.type)).toEqual(["text", "text", "image_url", "text", "image_url", "text"]);
    expect(content[1]).toEqual({ type: "text", text: "Média 1 — photo (couverture)" });
    expect(content[2]).toEqual({ type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } });
    const request = (content.at(-1) as { text: string }).text;
    expect(request).toContain("n'entends pas le son");
    expect(request).toContain("déjà présents : #lumen");
  });

  it("refuse une demande sans image ou avec une image invalide", () => {
    expect(buildTaskMessages("mediaAnalysis", { post, images: [] }, brand)).toEqual({
      ok: false,
      error: "Aucun média à analyser",
    });
    const bad = { label: "x", dataUrl: "https://exemple.fr/photo.jpg" };
    expect(buildTaskMessages("mediaAnalysis", { post, images: [bad] }, brand).ok).toBe(false);
  });

  it("lit et complète la réponse du modèle", () => {
    const raw =
      '[THINK]Je regarde…[/THINK]{"description": "Une équipe autour d\'un écran.", "title": "Séminaire", "captions": ["Une", "Deux"], "hashtags": ["teamwork", "#Equipe", "#equipe"]}';
    expect(parseTaskOutput("mediaAnalysis", raw)).toEqual({
      description: "Une équipe autour d'un écran.",
      title: "Séminaire",
      captions: ["Une", "Deux"],
      hashtags: ["#teamwork", "#Equipe"],
      cta: "",
    });
  });
});

describe("suggestFormat", () => {
  it("adapte le format par défaut aux médias ajoutés", () => {
    expect(suggestFormat("image", ["video/mp4"])).toBe("video");
    expect(suggestFormat("image", ["image/jpeg", "image/png"])).toBe("carousel");
    expect(suggestFormat("image", ["image/jpeg"])).toBeNull();
  });

  it("ne touche pas à un format choisi", () => {
    expect(suggestFormat("story", ["video/mp4"])).toBeNull();
    expect(suggestFormat("carousel", ["video/mp4", "image/jpeg"])).toBeNull();
  });
});
