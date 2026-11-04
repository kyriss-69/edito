import { isDoneKind } from "./columns";
import { dueState } from "./post-status";
import type { PostDTO } from "./types";

/** Filtre « État » : où en est le post. */
export const DUE_FILTERS = [
  { id: "overdue", label: "En retard" },
  { id: "week", label: "7 prochains jours" },
  { id: "unscheduled", label: "Sans date" },
  { id: "incomplete", label: "Checklist incomplète" },
] as const;

const WEEK = 7 * 24 * 60 * 60 * 1000;

export type PostFilters = {
  q: string;
  platform: string;
  format: string;
  pillar: string;
  campaign: string;
  priority: string;
  due: string;
};

export const FILTER_KEYS = ["q", "platform", "format", "pillar", "campaign", "priority", "due"] as const;

export const EMPTY_FILTERS: PostFilters = {
  q: "",
  platform: "",
  format: "",
  pillar: "",
  campaign: "",
  priority: "",
  due: "",
};

export function hasActiveFilters(filters: PostFilters) {
  return FILTER_KEYS.some((key) => filters[key] !== "");
}

/** Filtres lus dans l'adresse de la page (`?platform=instagram&q=…`). */
export function filtersFromSearch(params: { get(key: string): string | null }): PostFilters {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ""])) as PostFilters;
}

/** Paramètres d'adresse pour des filtres (les filtres vides sont omis). */
export function filtersToSearch(filters: PostFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function filterPosts(
  posts: PostDTO[],
  filters: PostFilters,
  /** Rôle de la colonne d'un post et heure de référence (pour le filtre « État »). */
  { kindOf = () => "progress", now = Date.now() }: { kindOf?: (columnId: number) => string; now?: number } = {},
): PostDTO[] {
  const q = filters.q.trim().toLowerCase();
  return posts.filter((post) => {
    if (filters.due && !matchesDue(post, filters.due, kindOf(post.columnId), now)) return false;
    if (filters.platform && !post.platforms.some((p) => p.platform === filters.platform)) {
      return false;
    }
    if (filters.format && post.format !== filters.format) return false;
    if (filters.priority && post.priority !== filters.priority) return false;
    if (filters.pillar) {
      if (filters.pillar === "none" ? post.pillarId !== null : String(post.pillarId) !== filters.pillar) {
        return false;
      }
    }
    if (filters.campaign) {
      if (
        filters.campaign === "none"
          ? post.campaignId !== null
          : String(post.campaignId) !== filters.campaign
      ) {
        return false;
      }
    }
    if (q) {
      const haystack = [post.title, post.caption, post.hashtags, post.notes]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function matchesDue(post: PostDTO, due: string, kind: string, now: number) {
  switch (due) {
    case "overdue":
      return dueState(post.scheduledAt, kind, now) === "overdue";
    case "week":
      return post.scheduledAt !== null && post.scheduledAt >= now && post.scheduledAt - now <= WEEK;
    case "unscheduled":
      return post.scheduledAt === null && !isDoneKind(kind);
    case "incomplete":
      return post.checklist.some((c) => !c.done);
    default:
      return true;
  }
}
