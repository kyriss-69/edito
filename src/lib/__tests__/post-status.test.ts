import { describe, expect, it } from "vitest";

import { dueState, readiness, scheduleLabel } from "../post-status";

const at = (iso: string) => new Date(iso).getTime();
const NOW = at("2026-10-14T09:00:00");

describe("dueState", () => {
  it("sans date", () => {
    expect(dueState(null, "progress", NOW)).toBe("none");
  });

  it("en retard si la date est passée et le post pas publié", () => {
    expect(dueState(at("2026-10-13T10:00:00"), "review", NOW)).toBe("overdue");
    expect(dueState(at("2026-10-13T10:00:00"), "published", NOW)).toBe("done");
    expect(dueState(at("2026-10-13T10:00:00"), "archived", NOW)).toBe("done");
  });

  it("bientôt dans les 24 h, à venir au-delà", () => {
    expect(dueState(at("2026-10-15T08:00:00"), "scheduled", NOW)).toBe("soon");
    expect(dueState(at("2026-10-16T10:00:00"), "scheduled", NOW)).toBe("upcoming");
  });
});

describe("scheduleLabel", () => {
  it("dit aujourd'hui, demain ou hier", () => {
    expect(scheduleLabel(at("2026-10-14T18:30:00"), NOW)).toBe("Aujourd'hui 18:30");
    expect(scheduleLabel(at("2026-10-15T10:00:00"), NOW)).toBe("Demain 10:00");
    expect(scheduleLabel(at("2026-10-13T07:05:00"), NOW)).toBe("Hier 07:05");
  });

  it("donne le jour et la date sinon, avec l'année si elle change", () => {
    expect(scheduleLabel(at("2026-10-19T10:00:00"), NOW)).toBe("Lun. 19 oct. · 10:00");
    expect(scheduleLabel(at("2027-01-04T10:00:00"), NOW)).toBe("4 janv. 2027 · 10:00");
  });
});

describe("readiness", () => {
  const base = {
    media: [],
    format: "image",
    caption: "",
    platforms: [],
    hashtags: "",
    scheduledAt: null,
    checklist: [{ label: "Relu", done: false }],
  };

  it("liste ce qui manque", () => {
    const result = readiness(base);
    expect(result.done).toBe(0);
    expect(result.total).toBe(6);
  });

  it("compte une légende personnalisée et un live sans média", () => {
    const result = readiness({
      ...base,
      format: "live",
      platforms: [{ platform: "instagram", customCaption: "Coucou", customHashtags: null }],
      checklist: [],
    });
    const done = result.items.filter((i) => i.done).map((i) => i.id);
    expect(done).toEqual(["media", "caption", "platforms", "checklist"]);
  });
});
