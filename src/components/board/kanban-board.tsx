"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { addDays, startOfDay } from "date-fns";
import { FilePlus2, LayoutGrid } from "lucide-react";
import Link from "next/link";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import { AiIcon } from "@/components/ai/ai-progress";
import { useOpenIdeas } from "@/components/ai/ideas-dialog";
import { useApp } from "@/components/app-provider";
import { BulkBar } from "@/components/planning/bulk-bar";
import { PlanningHeader } from "@/components/planning/planning-header";
import { usePostFilters } from "@/components/planning/use-post-filters";
import { PostCard } from "@/components/posts/post-card";
import { ColorDot } from "@/components/posts/platform-badge";
import { SchedulePicker } from "@/components/posts/schedule-picker";
import { useNow } from "@/components/use-now";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { findContainer, moveItem, type BoardState } from "@/lib/board";
import { moveToDay } from "@/lib/calendar";
import { composeCaption } from "@/lib/captions";
import { isDoneKind } from "@/lib/columns";
import { BOARD_DENSITIES, type BoardDensity } from "@/lib/preferences";
import { PRODUCT } from "@/lib/product";
import type { ColumnDTO, PostDTO } from "@/lib/types";
import {
  bulkMovePosts,
  deletePost,
  duplicatePost,
  reorderColumn,
  reschedulePost,
  saveUiPreferences,
  setPublishedUrl,
} from "@/server/actions";

import { postKey } from "./board-card";
import { BoardContext, type PostActions } from "./board-context";
import { AddColumn, BoardColumn, CollapsedColumn, columnKey } from "./board-column";

const idOf = (key: string) => Number(key.split("-")[1]);

/** Cible sous le pointeur (un post de préférence à sa colonne), sinon la plus proche. */
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const postHits = hits.filter((hit) => String(hit.id).startsWith("post-"));
  if (postHits.length) return postHits;
  if (hits.length) return hits;
  return closestCorners(args);
};

function buildState(columns: ColumnDTO[], posts: PostDTO[]): BoardState {
  // Les posts arrivent déjà triés par position.
  return Object.fromEntries(
    columns.map((c) => [
      columnKey(c.id),
      posts.filter((p) => p.columnId === c.id).map((p) => postKey(p.id)),
    ]),
  );
}

/** Question posée après avoir déposé un post dans certaines colonnes. */
type Prompt = { type: "schedule" | "published"; post: PostDTO; column: ColumnDTO };

/** Demande quelle date donner à un post déposé dans une colonne « Planifié » sans date. */
function SchedulePrompt({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [value, setValue] = useState<number | null>(() => moveToDay(null, addDays(startOfDay(new Date()), 1)));
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quand publier ce post ?</DialogTitle>
          <DialogDescription>
            « {prompt.post.title} » est dans {prompt.column.name} mais n&apos;a pas encore de date.
          </DialogDescription>
        </DialogHeader>
        <SchedulePicker value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Plus tard
          </Button>
          <Button
            disabled={value === null}
            onClick={() => {
              void reschedulePost(prompt.post.id, value);
              onClose();
            }}
          >
            Planifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Propose d'enregistrer le lien d'un post déposé dans une colonne « Publié ». */
function PublishedPrompt({ prompt, onClose }: { prompt: Prompt; onClose: () => void }) {
  const [url, setUrl] = useState("");
  function save() {
    if (url.trim()) void setPublishedUrl(prompt.post.id, url);
    onClose();
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Post publié 🎉</DialogTitle>
          <DialogDescription>
            Colle le lien de « {prompt.post.title} » pour le retrouver facilement (facultatif).
          </DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="https://www.instagram.com/p/…"
          aria-label="Lien du post publié"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Passer
          </Button>
          <Button onClick={save}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Menu « Affichage » : densité des cartes, colonnes repliées. */
function DisplayMenu({
  density,
  onDensityChange,
  onCollapseDone,
  onExpandAll,
}: {
  density: BoardDensity;
  onDensityChange: (density: BoardDensity) => void;
  onCollapseDone: () => void;
  onExpandAll: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <LayoutGrid /> Affichage
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Cartes</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={density} onValueChange={(v) => onDensityChange(v as BoardDensity)}>
          {BOARD_DENSITIES.map((d) => (
            <DropdownMenuRadioItem key={d.id} value={d.id}>
              <div className="flex flex-col">
                <span>{d.label}</span>
                <span className="text-xs text-muted-foreground">{d.description}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Colonnes</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onCollapseDone}>Replier « Publié » et « Archivé »</DropdownMenuItem>
        <DropdownMenuItem onSelect={onExpandAll}>Tout déplier</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Tableau encore vide : par où commencer. */
function WelcomeBanner() {
  const { newPost } = useApp();
  const openIdeas = useOpenIdeas();
  return (
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 md:mx-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Bienvenue sur {PRODUCT.name} 👋</p>
        <p className="text-xs text-muted-foreground">
          Chaque carte est un post : il avance de colonne en colonne, de l&apos;idée à la publication. Ajoute ton
          premier post, ou laisse l&apos;assistant te proposer des idées.
        </p>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/home">Bien démarrer</Link>
      </Button>
      <Button variant="outline" size="sm" onClick={openIdeas}>
        <AiIcon /> Idées
      </Button>
      <Button size="sm" onClick={() => newPost()}>
        <FilePlus2 /> Nouveau post
      </Button>
    </div>
  );
}

/** Sur mobile : accès direct à chaque colonne (le tableau défile colonne par colonne). */
function MobileColumnTabs({ columns, counts }: { columns: ColumnDTO[]; counts: Map<number, number> }) {
  return (
    <nav className="flex gap-1.5 overflow-x-auto px-4 pt-3 md:hidden" aria-label="Colonnes">
      {columns.map((column) => (
        <button
          key={column.id}
          type="button"
          onClick={() =>
            document.getElementById(columnKey(column.id))?.scrollIntoView({ behavior: "smooth", inline: "center" })
          }
          className="flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium"
        >
          <ColorDot color={column.color} />
          {column.name}
          <span className="text-muted-foreground tabular-nums">{counts.get(column.id) ?? 0}</span>
        </button>
      ))}
    </nav>
  );
}

export function KanbanBoard() {
  const { meta, posts, openPost } = useApp();
  const { apply } = usePostFilters();
  const now = useNow();

  const [items, setItems] = useState(() => buildState(meta.columns, posts));
  const [synced, setSynced] = useState({ columns: meta.columns, posts });
  // Resynchronise avec les données serveur après chaque rafraîchissement.
  if (synced.columns !== meta.columns || synced.posts !== posts) {
    setSynced({ columns: meta.columns, posts });
    setItems(buildState(meta.columns, posts));
  }

  // Préférences d'affichage, appliquées tout de suite puis enregistrées.
  const [prefs, setPrefs] = useState(meta.ui);
  const [syncedPrefs, setSyncedPrefs] = useState(meta.ui);
  if (syncedPrefs !== meta.ui) {
    setSyncedPrefs(meta.ui);
    setPrefs(meta.ui);
  }
  const collapsed = useMemo(
    () => new Set(prefs.collapsedColumns ?? meta.columns.filter((c) => isDoneKind(c.kind)).map((c) => c.id)),
    [prefs.collapsedColumns, meta.columns],
  );
  function updatePrefs(next: Partial<typeof prefs>) {
    setPrefs((prev) => ({ ...prev, ...next }));
    void saveUiPreferences(next);
  }
  function toggleCollapsed(columnId: number) {
    const next = new Set(collapsed);
    if (next.has(columnId)) next.delete(columnId);
    else next.add(columnId);
    updatePrefs({ collapsedColumns: [...next] });
  }

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [startItems, setStartItems] = useState<BoardState | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [deleting, setDeleting] = useState<PostDTO | null>(null);

  const postsById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const columnsById = useMemo(() => new Map(meta.columns.map((c) => [c.id, c])), [meta.columns]);
  const visible = useMemo(() => new Set(apply(posts).map((p) => postKey(p.id))), [posts, apply]);
  // La sélection ne garde que les posts encore affichés.
  const selectedIds = [...selected].filter((id) => visible.has(postKey(id)));

  /** Après un changement de colonne : demande la date ou le lien publié si utile. */
  function afterMove(post: PostDTO, column: ColumnDTO) {
    if (column.kind === "scheduled" && post.scheduledAt === null) setPrompt({ type: "schedule", post, column });
    else if (column.kind === "published" && !post.publishedUrl) setPrompt({ type: "published", post, column });
  }

  const report = (result: { ok: boolean; error?: string }) => {
    if (!result.ok) toast.error(result.error ?? "Action impossible");
  };

  const actions: PostActions = {
    move(post, column) {
      void bulkMovePosts([post.id], column.id).then(report);
      afterMove(post, column);
    },
    schedule(post, scheduledAt) {
      void reschedulePost(post.id, scheduledAt).then(report);
    },
    duplicate(post) {
      void duplicatePost(post.id).then((result) => {
        if (!result.ok) return report(result);
        toast.success("Post dupliqué", { action: { label: "Ouvrir", onClick: () => openPost(result.data.id) } });
      });
    },
    async copyCaption(post) {
      await navigator.clipboard.writeText(composeCaption(post.caption, post.hashtags));
      toast.success("Légende et hashtags copiés");
    },
    remove(post) {
      setDeleting(post);
    },
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Sur écran tactile : appui long pour saisir un post (le glissement simple fait défiler).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveKey(String(active.id));
    setStartItems(items);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const from = findContainer(items, String(active.id));
    const to = findContainer(items, String(over.id));
    // Une colonne repliée n'affiche pas ses posts : on y dépose à la fin, au lâcher.
    if (!from || !to || from === to || collapsed.has(idOf(to))) return;
    const translated = active.rect.current.translated;
    const placeAfter =
      translated !== null && translated.top > over.rect.top + over.rect.height / 2;
    setItems(moveItem(items, String(active.id), String(over.id), placeAfter));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveKey(null);
    const next = over ? moveItem(items, String(active.id), String(over.id)) : items;
    setItems(next);

    const container = findContainer(next, String(active.id));
    if (!container || !startItems) return;
    const before = startItems[container];
    const after = next[container];
    if (before.length === after.length && before.every((key, i) => key === after[i])) return;

    reorderColumn(idOf(container), after.map(idOf)).then(report);
    const post = postsById.get(idOf(String(active.id)));
    const column = columnsById.get(idOf(container));
    if (post && column && post.columnId !== column.id) afterMove(post, column);
  }

  function handleDragCancel() {
    setActiveKey(null);
    if (startItems) setItems(startItems);
  }

  const titleOf = (key: string | number) => postsById.get(idOf(String(key)))?.title ?? "le post";
  const placeOf = (key: string | number) => {
    const container = findContainer(items, String(key));
    return container ? (columnsById.get(idOf(container))?.name ?? "une colonne") : "une colonne";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `« ${titleOf(active.id)} » saisi.`,
    onDragOver: ({ active, over }) =>
      over ? `« ${titleOf(active.id)} » au-dessus de ${placeOf(over.id)}.` : "Hors des colonnes.",
    onDragEnd: ({ active, over }) =>
      over ? `« ${titleOf(active.id)} » déposé dans ${placeOf(over.id)}.` : `« ${titleOf(active.id)} » relâché.`,
    onDragCancel: ({ active }) => `Déplacement de « ${titleOf(active.id)} » annulé.`,
  };

  // Échap vide la sélection (sauf si une fenêtre est ouverte).
  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Escape" || !selected.size) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
    setSelected(new Set());
  });
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activePost = activeKey ? postsById.get(idOf(activeKey)) : undefined;
  const visibleCounts = new Map(
    meta.columns.map((c) => [c.id, (items[columnKey(c.id)] ?? []).filter((key) => visible.has(key)).length]),
  );

  const board = {
    density: prefs.boardDensity,
    now,
    selected,
    toggleSelected: (postId: number) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId);
        else next.add(postId);
        return next;
      }),
    actions,
  };

  return (
    <BoardContext.Provider value={board}>
      <PlanningHeader>
        <DisplayMenu
          density={prefs.boardDensity}
          onDensityChange={(boardDensity) => updatePrefs({ boardDensity })}
          onCollapseDone={() => updatePrefs({ collapsedColumns: null })}
          onExpandAll={() => updatePrefs({ collapsedColumns: [] })}
        />
      </PlanningHeader>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {posts.length === 0 && <WelcomeBanner />}
        <MobileColumnTabs columns={meta.columns} counts={visibleCounts} />
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "Entrée ouvre le post. Pour le déplacer : Espace pour le saisir, flèches pour choisir sa place, Espace pour le déposer, Échap pour annuler.",
            },
          }}
        >
          <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-4 md:snap-none md:px-6">
            {meta.columns.map((column) => {
              const all = items[columnKey(column.id)] ?? [];
              const shown = all.filter((key) => visible.has(key) || key === activeKey);
              return collapsed.has(column.id) ? (
                <CollapsedColumn
                  key={column.id}
                  column={column}
                  count={shown.length}
                  onExpand={() => toggleCollapsed(column.id)}
                />
              ) : (
                <BoardColumn
                  key={column.id}
                  column={column}
                  itemKeys={shown}
                  total={all.length}
                  postsById={postsById}
                  onCollapse={() => toggleCollapsed(column.id)}
                />
              );
            })}
            <AddColumn />
          </div>
          <DragOverlay>
            {activePost && <PostCard post={activePost} density={prefs.boardDensity} now={now} dragging />}
          </DragOverlay>
        </DndContext>
        {selectedIds.length > 0 && <BulkBar ids={selectedIds} onClear={() => setSelected(new Set())} />}
      </div>

      {prompt?.type === "schedule" && <SchedulePrompt prompt={prompt} onClose={() => setPrompt(null)} />}
      {prompt?.type === "published" && <PublishedPrompt prompt={prompt} onClose={() => setPrompt(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Supprimer « ${deleting?.title ?? ""} » ?`}
        description="Le post et ses médias seront définitivement supprimés."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!deleting) return;
          const { id } = deleting;
          void deletePost(id).then(() => toast.success("Post supprimé"));
        }}
      />
    </BoardContext.Provider>
  );
}
