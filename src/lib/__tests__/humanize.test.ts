import { describe, expect, it } from "vitest";

import { cleanAiOutput, cleanAiText, detectAiTells } from "../humanize";

describe("anti-IA", () => {
  it("retire les caractères invisibles et les tirets longs", () => {
    expect(cleanAiText("Zéro​ commission — jamais.")).toBe("Zéro commission, jamais.");
    expect(cleanAiText("Une agence prend 20–35 %.")).toBe("Une agence prend 20-35 %.");
    expect(cleanAiText("— Premier point\n— Second")).toBe("- Premier point\n- Second");
    expect(cleanAiText("Ton media kit…")).toBe("Ton media kit…");
  });

  it("nettoie toutes les chaînes d'une réponse", () => {
    expect(cleanAiOutput({ slides: [{ title: "A — B", screen: 3 }] })).toEqual({ slides: [{ title: "A, B", screen: 3 }] });
  });

  it("repère les tournures toutes faites", () => {
    const labels = detectAiTells(
      "Ce n'est pas un outil, c'est une révolution.\nLe résultat ?\nN'hésite pas à t'abonner pour plus.",
    ).map((t) => t.label);
    expect(labels).toContain("« Ce n'est pas X, c'est Y »");
    expect(labels).toContain("Question-réponse mise en scène (« Le résultat ? »)");
    expect(labels).toContain("« N'hésite pas à »");
    expect(detectAiTells("Tu n'as pas besoin de 100k abonnés pour être payé.")).toEqual([]);
  });
});

describe("vérification d'une légende", async () => {
  const { lintCaption } = await import("../caption-lint");

  it("signale le lien mort, les appels multiples et les hashtags vides", () => {
    const lint = lintCaption(
      "instagram",
      "Ton media kit mérite mieux qu'un PDF.\n\nInscris-toi sur https://lumen.fr et enregistre ce post.",
      "#fyp #mediakit",
    );
    const messages = lint.issues.map((i) => i.message).join("\n");
    expect(messages).toContain("Lien dans la légende");
    expect(messages).toContain("appels à l'action");
    expect(messages).toContain("#fyp");
  });

  it("ne compte « lien en bio » à côté d'une demande que comme un seul appel", () => {
    const lint = lintCaption(
      "instagram",
      "Fini les DM sans réponse.\n\nRejoins la liste d'attente (lien en bio) et deviens créateur fondateur.",
      "",
    );
    expect(lint.issues.map((i) => i.message).join("\n")).not.toContain("appels à l'action");
  });

  it("montre ce qui s'affiche avant « plus »", () => {
    const lint = lintCaption("instagram", "a".repeat(200), "");
    expect(lint.cut).toBe(true);
    expect(lint.visible).toHaveLength(125);
    expect(lintCaption("linkedin", "a".repeat(200), "").cut).toBe(false);
    expect(lintCaption("linkedin", "a".repeat(300), "").visible).toHaveLength(210);
    expect(lintCaption("x", "a".repeat(200), "").visible).toBeNull();
  });

  it("applique les règles de chaque réseau", () => {
    const messages = (platform: Parameters<typeof lintCaption>[0], caption: string, tags = "") =>
      lintCaption(platform, caption, tags).issues.map((i) => i.message).join("\n");
    expect(messages("linkedin", "Voici mon retour : https://lumen.fr")).toContain("premier commentaire");
    expect(messages("linkedin", "Tu veux plus de clients ?")).toContain("affirmation");
    expect(messages("linkedin", "Trois leçons.")).toContain("Texte court");
    expect(messages("x", "a".repeat(300))).toContain("280 au maximum");
    expect(messages("x", "Court.", "#a #b #c")).toContain("2 au plus");
    expect(messages("instagram", "Court.", "#a #b #c")).not.toContain("hashtags :");
  });
});

describe("légende proposée par l'IA", async () => {
  const { cleanAiCaption } = await import("../humanize");
  it("retire les guillemets parasites et la ligne de hashtags", () => {
    expect(cleanAiCaption('"Ton media kit en un lien.\n\nLien en bio.\n\n#MediaKit #UGC')).toBe("Ton media kit en un lien.\n\nLien en bio.");
    expect(cleanAiCaption('« Bonjour » dit-il. "Oui"')).toBe('« Bonjour » dit-il. "Oui"');
  });
});
