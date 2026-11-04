import { describe, expect, it } from "vitest";

import { isBelowTarget, monthGrid, moveToDay, weekDays } from "../calendar";

describe("monthGrid", () => {
  it("commence un lundi et couvre tout le mois", () => {
    const weeks = monthGrid(new Date(2026, 8, 15)); // septembre 2026
    expect(weeks[0][0].getDay()).toBe(1);
    expect(weeks[0][0].getDate()).toBe(31); // lundi 31 août
    const last = weeks.at(-1)!.at(-1)!;
    expect(last.getDay()).toBe(0);
    expect(last.getDate()).toBe(4); // dimanche 4 octobre
    expect(weeks).toHaveLength(5);
  });
});

describe("weekDays", () => {
  it("renvoie les 7 jours de la semaine, du lundi au dimanche", () => {
    const days = weekDays(new Date(2026, 8, 26)); // samedi
    expect(days.map((d) => d.getDate())).toEqual([21, 22, 23, 24, 25, 26, 27]);
  });
});

describe("moveToDay", () => {
  it("garde l'heure existante", () => {
    const original = new Date(2026, 8, 1, 18, 30).getTime();
    const moved = new Date(moveToDay(original, new Date(2026, 8, 10)));
    expect([moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([
      10, 18, 30,
    ]);
  });

  it("utilise 10h pour un post non planifié", () => {
    const moved = new Date(moveToDay(null, new Date(2026, 8, 10, 23)));
    expect([moved.getDate(), moved.getHours()]).toEqual([10, 10]);
  });
});

describe("isBelowTarget", () => {
  it("compare au rythme visé quand il existe", () => {
    expect(isBelowTarget(2, 3, false)).toBe(true);
    expect(isBelowTarget(3, 3, false)).toBe(false);
  });

  it("signale seulement les semaines vides sans objectif", () => {
    expect(isBelowTarget(0, null, false)).toBe(true);
    expect(isBelowTarget(1, null, false)).toBe(false);
    expect(isBelowTarget(0, 0, false)).toBe(true);
  });

  it("ne signale jamais une semaine passée", () => {
    expect(isBelowTarget(0, 3, true)).toBe(false);
  });
});
