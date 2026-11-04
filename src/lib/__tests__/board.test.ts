import { describe, expect, it } from "vitest";

import { findContainer, moveItem } from "../board";

const state = { a: ["1", "2", "3"], b: ["4"] };

describe("moveItem", () => {
  it("réordonne dans la même colonne", () => {
    expect(moveItem(state, "1", "3").a).toEqual(["2", "3", "1"]);
    expect(moveItem(state, "3", "1").a).toEqual(["3", "1", "2"]);
  });

  it("déplace vers une autre colonne avant l'élément survolé", () => {
    const next = moveItem(state, "2", "4");
    expect(next.a).toEqual(["1", "3"]);
    expect(next.b).toEqual(["2", "4"]);
  });

  it("peut placer après l'élément survolé", () => {
    expect(moveItem(state, "2", "4", true).b).toEqual(["4", "2"]);
  });

  it("ajoute en fin de colonne quand on survole la colonne", () => {
    expect(moveItem(state, "1", "b").b).toEqual(["4", "1"]);
  });

  it("ne change rien pour un id inconnu", () => {
    expect(moveItem(state, "9", "a")).toBe(state);
  });

  it("trouve la colonne d'un élément", () => {
    expect(findContainer(state, "4")).toBe("b");
    expect(findContainer(state, "a")).toBe("a");
    expect(findContainer(state, "x")).toBeUndefined();
  });
});
