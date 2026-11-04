"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useApp } from "@/components/app-provider";
import {
  EMPTY_FILTERS,
  filterPosts,
  filtersFromSearch,
  filtersToSearch,
  hasActiveFilters,
  type PostFilters,
} from "@/lib/filters";
import type { PostDTO } from "@/lib/types";

/**
 * Filtres des vues du Planning, gardés dans l'adresse de la page (`?platform=…`) :
 * ils suivent d'une vue à l'autre et survivent à un rechargement.
 */
export function usePostFilters() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => filtersFromSearch(searchParams), [searchParams]);

  const setFilters = useCallback(
    (next: PostFilters) => {
      // Sans aller-retour serveur : Next synchronise useSearchParams avec l'historique.
      window.history.replaceState(null, "", `${pathname}${filtersToSearch(next)}`);
    },
    [pathname],
  );

  const setFilter = useCallback(
    (key: keyof PostFilters, value: string) => setFilters({ ...filters, [key]: value }),
    [filters, setFilters],
  );

  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  const { meta } = useApp();
  /** Applique les filtres à une liste de posts. */
  const apply = useCallback(
    (posts: PostDTO[]) => {
      const kinds = new Map(meta.columns.map((c) => [c.id, c.kind]));
      return filterPosts(posts, filters, { kindOf: (id) => kinds.get(id) ?? "progress" });
    },
    [filters, meta.columns],
  );

  return {
    filters,
    apply,
    setFilter,
    resetFilters,
    active: hasActiveFilters(filters),
    /** Paramètres à ajouter aux liens vers les autres vues. */
    search: filtersToSearch(filters),
  };
}
