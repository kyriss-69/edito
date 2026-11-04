import { describe, expect, it } from "vitest";

import {
  createSseParser,
  escapeControlCharsInStrings,
  extractJson,
  isInsideReasoning,
  stripReasoning,
} from "../ai/parse";

describe("stripReasoning", () => {
  it("retire les blocs <think> et [THINK]", () => {
    expect(stripReasoning("<think>hmm</think>\nRéponse")).toBe("Réponse");
    expect(stripReasoning("[THINK]je réfléchis[/THINK]{\"a\":1}")).toBe('{"a":1}');
  });

  it("ignore un bloc de réflexion jamais fermé", () => {
    expect(stripReasoning("[THINK]pas fini…")).toBe("");
  });

  it("détecte qu'on est encore dans la réflexion", () => {
    expect(isInsideReasoning("[THINK]en cours")).toBe(true);
    expect(isInsideReasoning("[THINK]fini[/THINK] texte")).toBe(false);
    expect(isInsideReasoning("texte")).toBe(false);
  });
});

describe("extractJson", () => {
  it("parse un JSON direct", () => {
    expect(extractJson('{"caption": "Salut"}')).toEqual({ caption: "Salut" });
  });

  it("parse un JSON entouré de texte et de blocs de code", () => {
    const raw = 'Voici :\n```json\n{"captions": ["a {b}", "c"]}\n```\nBonne journée';
    expect(extractJson(raw)).toEqual({ captions: ["a {b}", "c"] });
  });

  it("ignore la réflexion qui contient des accolades", () => {
    const raw = '<think>peut-être {"x": 1} ?</think>{"caption": "ok"}';
    expect(extractJson(raw)).toEqual({ caption: "ok" });
  });

  it("gère les guillemets échappés", () => {
    expect(extractJson('texte {"caption": "Il dit \\"oui\\" }"} fin')).toEqual({
      caption: 'Il dit "oui" }',
    });
  });

  it("renvoie undefined sans JSON", () => {
    expect(extractJson("aucun json ici")).toBeUndefined();
  });
});

describe("createSseParser", () => {
  it("reconstitue les lignes data: coupées entre deux morceaux", () => {
    const received: string[] = [];
    const push = createSseParser((d) => received.push(d));
    push('data: {"a":');
    push('1}\n\ndata: [DONE]\r\n');
    expect(received).toEqual(['{"a":1}', "[DONE]"]);
  });
});

describe("sauts de ligne bruts dans les chaînes", () => {
  it("répare un JSON avec de vrais sauts de ligne dans une chaîne", () => {
    const raw = '{"brief": "IDÉE\n- un carrousel\n\nCOULEURS\n- crème"}';
    expect(extractJson(raw)).toEqual({ brief: "IDÉE\n- un carrousel\n\nCOULEURS\n- crème" });
  });

  it("ne touche pas aux sauts de ligne hors des chaînes", () => {
    expect(escapeControlCharsInStrings('{\n  "a": "x\ny"\n}')).toBe('{\n  "a": "x\\ny"\n}');
  });
});
