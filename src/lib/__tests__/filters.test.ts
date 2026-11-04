import { describe, expect, it } from "vitest";

import { EMPTY_FILTERS, filterPosts, filtersFromSearch, filtersToSearch, hasActiveFilters } from "../filters";
import type { PostDTO } from "../types";

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

const posts = [
  post({ id: 1, title: "Astuce Lumen", platforms: [{ platform: "instagram", customCaption: null, customHashtags: null }], pillarId: 2 }),
  post({ id: 2, title: "Coulisses", format: "video", platforms: [{ platform: "tiktok", customCaption: null, customHashtags: null }] }),
  post({ id: 3, title: "Autre", hashtags: "#lumen", campaignId: 5, priority: "high" }),
];

const ids = (list: PostDTO[]) => list.map((p) => p.id);

describe("filterPosts", () => {
  it("ne filtre rien sans filtre actif", () => {
    expect(ids(filterPosts(posts, EMPTY_FILTERS))).toEqual([1, 2, 3]);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
  });

  it("filtre par réseau et par format", () => {
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, platform: "tiktok" }))).toEqual([2]);
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, format: "video" }))).toEqual([2]);
  });

  it("filtre par pilier, y compris « aucun »", () => {
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, pillar: "2" }))).toEqual([1]);
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, pillar: "none" }))).toEqual([2, 3]);
  });

  it("filtre par campagne", () => {
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, campaign: "5" }))).toEqual([3]);
  });

  it("recherche dans le titre et les hashtags sans tenir compte de la casse", () => {
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, q: "LUMEN" }))).toEqual([1, 3]);
  });

  it("filtre par priorité", () => {
    expect(ids(filterPosts(posts, { ...EMPTY_FILTERS, priority: "high" }))).toEqual([3]);
  });
});

describe("filtres dans l'adresse", () => {
  it("lit les filtres présents et laisse les autres vides", () => {
    const filters = filtersFromSearch(new URLSearchParams("platform=tiktok&q=astuce&view=x"));
    expect(filters).toEqual({ ...EMPTY_FILTERS, platform: "tiktok", q: "astuce" });
  });

  it("n'écrit que les filtres actifs, et rien sans filtre", () => {
    expect(filtersToSearch({ ...EMPTY_FILTERS, pillar: "none", q: "a b" })).toBe("?q=a+b&pillar=none");
    expect(filtersToSearch(EMPTY_FILTERS)).toBe("");
  });
});

describe("filtre « État »", () => {
  const NOW = new Date("2026-10-14T09:00:00").getTime();
  const day = 24 * 60 * 60 * 1000;
  const list = [
    post({ id: 1, scheduledAt: NOW - day, columnId: 1 }),
    post({ id: 2, scheduledAt: NOW - day, columnId: 2 }),
    post({ id: 3, scheduledAt: NOW + 2 * day, checklist: [{ label: "Relu", done: false }] }),
    post({ id: 4, scheduledAt: NOW + 10 * day }),
    post({ id: 5 }),
    post({ id: 6, columnId: 2 }),
  ];
  // Colonne 2 = « Publié ».
  const options = { kindOf: (columnId: number) => (columnId === 2 ? "published" : "progress"), now: NOW };
  const due = (value: string) => ids(filterPosts(list, { ...EMPTY_FILTERS, due: value }, options));

  it("en retard : date passée hors des colonnes terminées", () => {
    expect(due("overdue")).toEqual([1]);
  });

  it("7 prochains jours, sans date, checklist incomplète", () => {
    expect(due("week")).toEqual([3]);
    expect(due("unscheduled")).toEqual([5]);
    expect(due("incomplete")).toEqual([3]);
  });
});
