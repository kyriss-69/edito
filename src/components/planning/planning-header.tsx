"use client";

import { ListFilter, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { IdeasButton } from "@/components/ai/ideas-dialog";
import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { MobileNavButton } from "@/components/page-header";
import { FormatIcon } from "@/components/posts/format-icon";
import { ColorDot } from "@/components/posts/platform-badge";
import { CreateMenu } from "@/components/shell/create-menu";
import { PLANNING_VIEWS } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { segmentedItem, segmentedList } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Hint } from "@/components/ui/tooltip";
import { DUE_FILTERS, type PostFilters } from "@/lib/filters";
import { platformChoices } from "@/lib/accounts";
import { FORMATS, formatLabel, isPlatformId, PLATFORMS, PRIORITIES, priorityOf } from "@/lib/platforms";
import { cn } from "@/lib/utils";

import { usePostFilters } from "./use-post-filters";

/** Onglets Tableau / Calendrier / Liste (les filtres suivent). */
function ViewTabs({ search }: { search: string }) {
  const pathname = usePathname();
  return (
    <nav className={segmentedList} aria-label="Vues du planning">
      {PLANNING_VIEWS.map((view) => (
        <Hint key={view.href} label={view.label} shortcut={view.shortcut}>
          <Link
            href={`${view.href}${search}`}
            aria-current={pathname === view.href ? "page" : undefined}
            className={segmentedItem}
          >
            <view.icon />
            <span className="max-sm:sr-only">{view.label}</span>
          </Link>
        </Hint>
      ))}
    </nav>
  );
}

const chipList = "flex flex-wrap gap-1.5 bg-transparent p-0";
const chip =
  "h-7 rounded-full border bg-card px-2.5 data-[state=on]:border-primary/40 data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:shadow-none";

function FilterGroup({
  label,
  filterKey,
  options,
}: {
  label: string;
  filterKey: keyof PostFilters;
  options: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  const { filters, setFilter } = usePostFilters();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <ToggleGroup
        type="single"
        value={filters[filterKey]}
        onValueChange={(value) => setFilter(filterKey, value)}
        className={chipList}
        aria-label={label}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value} className={chip}>
            {option.icon}
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Libellés des filtres actifs, affichés en pastilles. */
function useActiveFilterLabels() {
  const { meta } = useApp();
  const { filters } = usePostFilters();
  const labels: { key: keyof PostFilters; label: string }[] = [];
  if (filters.platform && filters.platform in PLATFORMS) {
    labels.push({ key: "platform", label: PLATFORMS[filters.platform as keyof typeof PLATFORMS].label });
  }
  const due = DUE_FILTERS.find((d) => d.id === filters.due);
  if (due) labels.push({ key: "due", label: due.label });
  if (filters.format) labels.push({ key: "format", label: formatLabel(filters.format) });
  if (filters.priority) labels.push({ key: "priority", label: `Priorité ${priorityOf(filters.priority).label.toLowerCase()}` });
  if (filters.pillar) {
    const pillar = meta.pillars.find((p) => String(p.id) === filters.pillar);
    labels.push({ key: "pillar", label: filters.pillar === "none" ? "Sans pilier" : (pillar?.name ?? "Pilier") });
  }
  if (filters.campaign) {
    const campaign = meta.campaigns.find((c) => String(c.id) === filters.campaign);
    labels.push({
      key: "campaign",
      label: filters.campaign === "none" ? "Sans campagne" : (campaign?.name ?? "Campagne"),
    });
  }
  return labels;
}

function FiltersPopover({ count }: { count: number }) {
  const { meta } = useApp();
  const { filters, resetFilters } = usePostFilters();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(count > 0 && "border-primary/40 text-primary")}>
          <ListFilter /> Filtres
          {count > 0 && (
            <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-4 p-4">
        <FilterGroup
          label="État"
          filterKey="due"
          options={DUE_FILTERS.map((d) => ({ value: d.id, label: d.label }))}
        />
        <FilterGroup
          label="Réseau"
          filterKey="platform"
          options={platformChoices(
            meta.accounts,
            isPlatformId(filters.platform) ? [filters.platform] : [],
          ).map((id) => ({
            value: id,
            label: PLATFORMS[id].label,
            icon: <PlatformIcon platform={id} colored />,
          }))}
        />
        <FilterGroup
          label="Format"
          filterKey="format"
          options={FORMATS.map((f) => ({ value: f.id, label: f.label, icon: <FormatIcon format={f.id} /> }))}
        />
        <FilterGroup
          label="Pilier"
          filterKey="pillar"
          options={[
            ...meta.pillars.map((p) => ({ value: String(p.id), label: p.name, icon: <ColorDot color={p.color} /> })),
            { value: "none", label: "Sans pilier" },
          ]}
        />
        {meta.campaigns.length > 0 && (
          <FilterGroup
            label="Campagne"
            filterKey="campaign"
            options={[
              ...meta.campaigns.map((c) => ({
                value: String(c.id),
                label: c.name,
                icon: <ColorDot color={c.color} />,
              })),
              { value: "none", label: "Sans campagne" },
            ]}
          />
        )}
        <FilterGroup
          label="Priorité"
          filterKey="priority"
          options={PRIORITIES.map((p) => ({ value: p.id, label: p.label, icon: <ColorDot color={p.color} /> }))}
        />
        {count > 0 && (
          <Button variant="ghost" size="sm" className="self-start" onClick={resetFilters}>
            <X /> Effacer les filtres
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SearchInput() {
  const { filters, setFilter } = usePostFilters();
  return (
    <div className="relative w-full sm:w-56">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        data-page-search
        value={filters.q}
        onChange={(e) => setFilter("q", e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && e.currentTarget.blur()}
        placeholder="Rechercher un post…"
        aria-label="Rechercher un post"
        className="h-8 pr-8 pl-8"
      />
      {filters.q ? (
        <button
          type="button"
          onClick={() => setFilter("q", "")}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Effacer la recherche"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 max-sm:hidden">/</Kbd>
      )}
    </div>
  );
}

/**
 * En-tête commun aux vues du Planning : onglets, recherche, filtres et actions.
 * `children` : commandes propres à la vue (navigation du calendrier, affichage du tableau…).
 */
export function PlanningHeader({ children }: { children?: React.ReactNode }) {
  const { posts } = useApp();
  const { setFilter, resetFilters, active, search, apply } = usePostFilters();
  const labels = useActiveFilterLabels();
  const matching = useMemo(() => (active ? apply(posts).length : 0), [active, posts, apply]);

  return (
    <header className="flex shrink-0 flex-col gap-2.5 border-b bg-card px-4 py-2.5 md:px-6">
      <div className="flex items-center gap-3">
        <MobileNavButton />
        <h1 className="text-base font-semibold max-sm:hidden">Planning</h1>
        <ViewTabs search={search} />
        <div className="ml-auto flex items-center gap-2">
          <IdeasButton />
          <CreateMenu compact className="md:hidden" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput />
        <FiltersPopover count={labels.length} />
        {labels.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key, "")}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-primary/10 pr-1.5 pl-2.5 text-xs font-medium text-primary hover:bg-primary/15"
            aria-label={`Retirer le filtre ${label}`}
          >
            {label}
            <X className="size-3" />
          </button>
        ))}
        {active && (
          <>
            <span className="text-xs text-muted-foreground tabular-nums">
              {matching} post{matching > 1 ? "s" : ""}
            </span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={resetFilters}>
              Tout effacer
            </Button>
          </>
        )}
        {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}
