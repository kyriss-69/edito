import { describe, expect, it } from "vitest";

import { homeTodos } from "../home";
import type { PostDTO } from "../types";

const NOW = new Date("2026-10-14T09:00:00").getTime();
const HOUR = 60 * 60 * 1000;

function post(overrides: Partial<PostDTO>): PostDTO {
  return {
    id: 1,
    title: "Post",
    caption: "",
    format: "image",
    columnId: 1,
    position: 0,
    scheduledAt: null,
    priority: "medium",
    pillarId: null,
    campaignId: null,
    hashtags: "",
    cta: "",
    link: "",
    notes: "",
    publishedUrl: "",
    aiMode: "open",
    research: null,
    createdAt: 0,
    updatedAt: 0,
    platforms: [],
    media: [],
    checklist: [],
    ...overrides,
  };
}

// Colonnes : 1 = en cours, 2 = à valider, 3 = publié.
const KINDS: Record<number, string> = { 1: "progress", 2: "review", 3: "published" };
const kindOf = (id: number) => KINDS[id];
const ids = (list: PostDTO[]) => list.map((p) => p.id);

const ready = {
  media: [{ id: 1, url: "", originalName: "", mimeType: "image/png", size: 1, position: 0 }],
  caption: "Légende",
  hashtags: "#tag",
  platforms: [{ platform: "instagram" as const, customCaption: null, customHashtags: null }],
};

describe("homeTodos", () => {
  const posts = [
    post({ id: 1, scheduledAt: NOW - 2 * HOUR }),
    post({ id: 2, scheduledAt: NOW - 2 * HOUR, columnId: 3 }),
    post({ id: 3, columnId: 2 }),
    post({ id: 4, columnId: 2, scheduledAt: NOW - HOUR }),
    post({ id: 5, scheduledAt: NOW + 30 * HOUR }),
    post({ id: 6, scheduledAt: NOW + 20 * HOUR, ...ready }),
    post({ id: 7, scheduledAt: NOW + 60 * HOUR }),
  ];
  const todos = homeTodos(posts, kindOf, NOW);

  it("liste les retards, du plus ancien au plus récent, sans les posts publiés", () => {
    expect(ids(todos.overdue)).toEqual([1, 4]);
  });

  it("liste les posts à valider qui ne sont pas déjà en retard", () => {
    expect(ids(todos.review)).toEqual([3]);
  });

  it("liste les posts des 48 prochaines heures qui ne sont pas prêts", () => {
    expect(ids(todos.upcoming)).toEqual([5]);
  });
});
