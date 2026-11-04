"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { ASSET_CATEGORIES, assetCategoryLabel } from "@/lib/library";
import type { AssetDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AssetThumb } from "./asset-thumb";

/** Filtres (catégorie + recherche) et grille de médias, partagés par la médiathèque et le sélecteur. */
export function useAssetFilters(assets: AssetDTO[]) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (category === "all" || a.category === category) &&
        (!q || `${a.title} ${a.originalName} ${a.notes}`.toLowerCase().includes(q)),
    );
  }, [assets, category, query]);
  return { category, setCategory, query, setQuery, visible };
}

export function AssetFilters({
  assets,
  category,
  setCategory,
  query,
  setQuery,
}: ReturnType<typeof useAssetFilters> & { assets: AssetDTO[] }) {
  const counts = new Map<string, number>();
  for (const a of assets) counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
  const chip = (id: string, label: string, count: number) => (
    <button
      key={id}
      type="button"
      aria-pressed={category === id}
      onClick={() => setCategory(id)}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        category === id ? "border-primary/40 bg-primary/10 font-medium" : "bg-card text-muted-foreground hover:bg-accent",
      )}
    >
      {label} <span className="text-muted-foreground">{count}</span>
    </button>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="h-8 w-44 pl-8"
        />
      </div>
      {chip("all", "Tous", assets.length)}
      {ASSET_CATEGORIES.filter((c) => counts.get(c.id)).map((c) => chip(c.id, c.label, counts.get(c.id) ?? 0))}
    </div>
  );
}

export function AssetGrid({
  assets,
  onSelect,
  selectedIds,
  emptyLabel = "Aucun média.",
}: {
  assets: AssetDTO[];
  onSelect: (asset: AssetDTO) => void;
  /** Ids sélectionnés, dans l'ordre de sélection (affiche un numéro). */
  selectedIds?: number[];
  emptyLabel?: string;
}) {
  if (!assets.length) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {assets.map((asset) => {
        const order = selectedIds ? selectedIds.indexOf(asset.id) : -1;
        return (
          <li key={asset.id}>
            <button
              type="button"
              onClick={() => onSelect(asset)}
              aria-pressed={selectedIds ? order !== -1 : undefined}
              className={cn(
                "group relative flex w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition-shadow hover:shadow-md",
                order !== -1 && "ring-2 ring-primary",
              )}
            >
              <AssetThumb asset={asset} className="aspect-square w-full" />
              {order !== -1 && (
                <span className="absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {order + 1}
                </span>
              )}
              <span className="truncate px-2 pt-1.5 text-xs font-medium">{asset.title}</span>
              <span className="px-2 pb-1.5 text-[11px] text-muted-foreground">
                {assetCategoryLabel(asset.category)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
