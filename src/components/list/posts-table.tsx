"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, Download, Rows3 } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { BulkBar } from "@/components/planning/bulk-bar";
import { PlanningHeader } from "@/components/planning/planning-header";
import { usePostFilters } from "@/components/planning/use-post-filters";
import { FormatIcon } from "@/components/posts/format-icon";
import { MediaThumb } from "@/components/posts/post-card";
import { ColorDot, PlatformBadge } from "@/components/posts/platform-badge";
import { SchedulePicker } from "@/components/posts/schedule-picker";
import { useNow } from "@/components/use-now";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatLabel, PLATFORMS, PRIORITIES, priorityOf } from "@/lib/platforms";
import { dueState, scheduleLabel } from "@/lib/post-status";
import type { PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { bulkMovePosts, reschedulePost } from "@/server/actions";

type SortKey = "title" | "status" | "scheduledAt" | "priority" | "updatedAt";
type Sort = { key: SortKey; dir: 1 | -1 };
type GroupBy = "none" | "status" | "pillar" | "campaign";

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: "none", label: "Sans regroupement" },
  { id: "status", label: "Par statut" },
  { id: "pillar", label: "Par pilier" },
  { id: "campaign", label: "Par campagne" },
];

const PRIORITY_RANK = Object.fromEntries(PRIORITIES.map((p, i) => [p.id, i]));

/** Cellule CSV (guillemets doublés, valeur entre guillemets si besoin). */
function csvCell(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Statut modifiable directement dans la ligne. */
function StatusCell({ post }: { post: PostDTO }) {
  const { meta } = useApp();
  const column = meta.columns.find((c) => c.id === post.columnId);
  return (
    <Select
      value={String(post.columnId)}
      onValueChange={(value) => {
        void bulkMovePosts([post.id], Number(value)).then((result) => {
          if (!result.ok) toast.error(result.error);
        });
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-7 border-transparent bg-transparent px-1.5 shadow-none hover:bg-accent dark:bg-transparent"
        aria-label="Statut"
      >
        {/* Libellé rendu côté serveur (sinon vide jusqu'au chargement du script). */}
        <SelectValue>
          {column && (
            <>
              <ColorDot color={column.color} />
              {column.name}
            </>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {meta.columns.map((c) => (
          <SelectItem key={c.id} value={String(c.id)}>
            <ColorDot color={c.color} />
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Date modifiable directement dans la ligne. */
function DateCell({ post, now }: { post: PostDTO; now: number }) {
  const { meta } = useApp();
  const kind = meta.columns.find((c) => c.id === post.columnId)?.kind ?? "progress";
  const state = dueState(post.scheduledAt, kind, now);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 px-1.5 font-normal tabular-nums",
            post.scheduledAt === null && "text-muted-foreground",
            state === "overdue" && "text-destructive",
            state === "soon" && "text-warning",
          )}
        >
          <CalendarClock />
          {post.scheduledAt === null ? "Planifier" : scheduleLabel(post.scheduledAt, now)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <SchedulePicker
          value={post.scheduledAt}
          onChange={(value) => {
            void reschedulePost(post.id, value).then((result) => {
              if (!result.ok) toast.error(result.error);
            });
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function PostsTable() {
  const { meta, posts, openPost } = useApp();
  const { apply, active } = usePostFilters();
  const now = useNow();
  const [sort, setSort] = useState<Sort>({ key: "scheduledAt", dir: 1 });
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const columnById = useMemo(() => new Map(meta.columns.map((c) => [c.id, c])), [meta.columns]);

  const rows = useMemo(() => {
    const compare: Record<SortKey, (a: PostDTO, b: PostDTO) => number> = {
      title: (a, b) => a.title.localeCompare(b.title, "fr"),
      status: (a, b) =>
        (columnById.get(a.columnId)?.position ?? 0) - (columnById.get(b.columnId)?.position ?? 0) ||
        a.position - b.position,
      scheduledAt: (a, b) => {
        // Les posts non planifiés restent toujours en bas.
        if (a.scheduledAt === null) return b.scheduledAt === null ? 0 : 1 * sort.dir;
        if (b.scheduledAt === null) return -1 * sort.dir;
        return a.scheduledAt - b.scheduledAt;
      },
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      updatedAt: (a, b) => a.updatedAt - b.updatedAt,
    };
    return [...apply(posts)].sort((a, b) => compare[sort.key](a, b) * sort.dir);
  }, [posts, apply, sort, columnById]);

  /** Lignes regroupées (statut, pilier ou campagne), dans l'ordre des réglages. */
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", color: "", rows }];
    const list =
      groupBy === "status" ? meta.columns : groupBy === "pillar" ? meta.pillars : meta.campaigns;
    const keyOf = (p: PostDTO) =>
      groupBy === "status" ? p.columnId : groupBy === "pillar" ? p.pillarId : p.campaignId;
    const result = list.map((item) => ({
      key: String(item.id),
      label: item.name,
      color: item.color,
      rows: rows.filter((r) => keyOf(r) === item.id),
    }));
    if (groupBy !== "status") {
      result.push({
        key: "none",
        label: groupBy === "pillar" ? "Sans pilier" : "Sans campagne",
        color: "#94a3b8",
        rows: rows.filter((r) => keyOf(r) === null),
      });
    }
    return result.filter((g) => g.rows.length);
  }, [groupBy, rows, meta.columns, meta.pillars, meta.campaigns]);

  // Ne garde que les sélections encore visibles.
  const selectedIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function toggle(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function exportCsv() {
    const header = [
      "Titre",
      "Statut",
      "Réseaux",
      "Format",
      "Publication",
      "Pilier",
      "Campagne",
      "Priorité",
      "Checklist",
      "Légende",
      "Hashtags",
      "Lien publié",
    ];
    const lines = rows.map((post) => {
      const done = post.checklist.filter((c) => c.done).length;
      return [
        post.title,
        columnById.get(post.columnId)?.name ?? "",
        post.platforms.map((p) => PLATFORMS[p.platform].label).join(", "),
        formatLabel(post.format),
        post.scheduledAt ? format(post.scheduledAt, "dd/MM/yyyy HH:mm") : "",
        meta.pillars.find((p) => p.id === post.pillarId)?.name ?? "",
        meta.campaigns.find((c) => c.id === post.campaignId)?.name ?? "",
        priorityOf(post.priority).label,
        post.checklist.length ? `${done}/${post.checklist.length}` : "",
        post.caption,
        post.hashtags,
        post.publishedUrl,
      ]
        .map(csvCell)
        .join(";");
    });
    // BOM : Excel ouvre le fichier en UTF-8 (accents corrects).
    const blob = new Blob([`﻿${[header.join(";"), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `posts-${format(now, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} post${rows.length > 1 ? "s" : ""} exporté${rows.length > 1 ? "s" : ""}`);
  }

  const header = (key: SortKey | null, label: string, className?: string) => (
    <th className={cn("px-3 py-2 text-left font-medium whitespace-nowrap", className)}>
      {key ? (
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {label}
          {sort.key === key ? (
            sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
          ) : (
            <ArrowUpDown className="size-3 opacity-40" />
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <>
      <PlanningHeader>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger size="sm" aria-label="Regrouper les posts">
            <Rows3 className="size-4" />
            <SelectValue>{GROUPS.find((g) => g.id === groupBy)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            {GROUPS.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
          <Download /> Exporter
        </Button>
      </PlanningHeader>

      <div className="relative flex min-h-0 flex-1 flex-col p-4 md:px-6">
        {rows.length === 0 ? (
          <EmptyState
            icon={Rows3}
            title={active ? "Aucun post ne correspond aux filtres" : "Aucun post pour le moment"}
            description={active ? "Essaie d'autres filtres." : "Crée ton premier post avec le bouton « Créer » ou la touche N."}
          />
        ) : (
          <div className="min-h-0 overflow-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 border-b bg-card text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={allSelected ? true : selectedIds.length > 0 ? "indeterminate" : false}
                      onCheckedChange={(checked) =>
                        setSelected(checked === true ? new Set(rows.map((r) => r.id)) : new Set())
                      }
                      aria-label="Tout sélectionner"
                    />
                  </th>
                  {header("title", "Titre", "min-w-64")}
                  {header("status", "Statut")}
                  {header(null, "Réseaux")}
                  {header(null, "Format")}
                  {header("scheduledAt", "Publication")}
                  {header(null, "Pilier", "max-lg:hidden")}
                  {header(null, "Campagne", "max-lg:hidden")}
                  {header("priority", "Priorité")}
                  {header(null, "Checklist")}
                  {header("updatedAt", "Modifié", "max-md:hidden")}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.key}>
                    {groupBy !== "none" && (
                      <tr className="border-b bg-muted/50">
                        <td colSpan={11} className="px-3 py-1.5 text-xs font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            <ColorDot color={group.color} />
                            {group.label}
                            <span className="font-normal text-muted-foreground">{group.rows.length}</span>
                          </span>
                        </td>
                      </tr>
                    )}
                    {group.rows.map((post) => {
                      const pillar = meta.pillars.find((p) => p.id === post.pillarId);
                      const campaign = meta.campaigns.find((c) => c.id === post.campaignId);
                      const priority = priorityOf(post.priority);
                      const done = post.checklist.filter((c) => c.done).length;
                      return (
                        <tr
                          key={post.id}
                          onClick={() => openPost(post.id)}
                          className={cn(
                            "cursor-pointer border-b last:border-0 hover:bg-accent/50",
                            selected.has(post.id) && "bg-accent/40",
                          )}
                        >
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(post.id)}
                              onCheckedChange={(checked) => toggle(post.id, checked === true)}
                              aria-label={`Sélectionner ${post.title}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {post.media[0] ? (
                                <MediaThumb media={post.media[0]} className="size-8 shrink-0 rounded" />
                              ) : (
                                <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                  <FormatIcon format={post.format} />
                                </div>
                              )}
                              <span className="line-clamp-1 font-medium">{post.title}</span>
                            </div>
                          </td>
                          <td className="px-1.5 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <StatusCell post={post} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1.5">
                              {post.platforms.map((p) => (
                                <PlatformBadge key={p.platform} platform={p.platform} compact />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <FormatIcon format={post.format} />
                              {formatLabel(post.format)}
                            </span>
                          </td>
                          <td className="px-1.5 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <DateCell post={post} now={now} />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap max-lg:hidden">
                            {pillar ? (
                              <span className="inline-flex items-center gap-1.5">
                                <ColorDot color={pillar.color} />
                                {pillar.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap max-lg:hidden">
                            {campaign ? (
                              <span className="inline-flex items-center gap-1.5">
                                <ColorDot color={campaign.color} />
                                {campaign.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <ColorDot color={priority.color} />
                              {priority.label}
                            </span>
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2 whitespace-nowrap tabular-nums text-muted-foreground",
                              post.checklist.length > 0 && done === post.checklist.length && "text-success",
                            )}
                          >
                            {post.checklist.length ? `${done}/${post.checklist.length}` : "—"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-md:hidden">
                            {format(post.updatedAt, "d MMM", { locale: fr })}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedIds.length > 0 && <BulkBar ids={selectedIds} onClear={() => setSelected(new Set())} />}
      </div>
    </>
  );
}
