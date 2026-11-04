"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  ArrowDownWideNarrow,
  FilePlus2,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  Palette,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ColorDot } from "@/components/posts/platform-badge";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/tooltip";
import { COLUMN_KINDS, TAG_COLORS } from "@/lib/columns";
import { emptyDraft } from "@/lib/post-draft";
import type { ColumnDTO, PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createTag, deleteTag, reorderColumn, savePost, setColumnKind, updateTag } from "@/server/actions";

import { BoardCard } from "./board-card";

export const columnKey = (id: number) => `column-${id}`;

/** Nom de colonne modifiable sur place (double-clic ou menu « Renommer »). */
function ColumnTitle({
  column,
  editing,
  onEditingChange,
}: {
  column: ColumnDTO;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
}) {
  const [name, setName] = useState(column.name);

  function commit() {
    onEditingChange(false);
    const next = name.trim();
    if (!next || next === column.name) {
      setName(column.name);
      return;
    }
    void updateTag("columns", column.id, { name: next, color: column.color }).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setName(column.name);
            onEditingChange(false);
          }
        }}
        aria-label="Nom de la colonne"
        className="h-7 px-1.5 text-sm font-semibold"
      />
    );
  }
  return (
    <h2
      className="truncate text-sm font-semibold"
      onDoubleClick={() => onEditingChange(true)}
      title="Double-clic pour renommer"
    >
      {column.name}
    </h2>
  );
}

function ColumnMenu({
  column,
  posts,
  onRename,
  onCollapse,
}: {
  column: ColumnDTO;
  posts: PostDTO[];
  onRename: () => void;
  onCollapse: () => void;
}) {
  const { newPost } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const report = (promise: Promise<{ ok: boolean; error?: string }>) =>
    void promise.then((result) => {
      if (!result.ok) toast.error(result.error ?? "Action impossible");
    });

  function sortByDate() {
    // Les posts datés d'abord, du plus proche au plus lointain ; les autres gardent leur ordre.
    const sorted = [...posts].sort((a, b) => {
      if (a.scheduledAt === null) return b.scheduledAt === null ? a.position - b.position : 1;
      if (b.scheduledAt === null) return -1;
      return a.scheduledAt - b.scheduledAt;
    });
    report(reorderColumn(column.id, sorted.map((p) => p.id)));
  }

  return (
    <>
      <DropdownMenu>
        <Hint label="Options de la colonne">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Options de la colonne ${column.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem onSelect={() => newPost({ columnId: column.id })}>
            <FilePlus2 /> Nouveau post ici
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => requestAnimationFrame(onRename)}>
            <Pencil /> Renommer
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette /> Couleur
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-0">
              <div className="grid grid-cols-4 gap-1 p-1">
                {TAG_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    className="justify-center p-1.5"
                    onSelect={() => report(updateTag("columns", column.id, { name: column.name, color }))}
                    aria-label={`Couleur ${color}`}
                  >
                    <ColorDot
                      color={color}
                      className={cn("size-4", color === column.color && "ring-2 ring-ring ring-offset-2 ring-offset-popover")}
                    />
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tags /> Rôle
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              <DropdownMenuLabel>Ce que représente la colonne</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={column.kind}
                onValueChange={(kind) => report(setColumnKind(column.id, kind))}
              >
                {COLUMN_KINDS.map((kind) => (
                  <DropdownMenuRadioItem key={kind.id} value={kind.id}>
                    <div className="flex flex-col">
                      <span>{kind.label}</span>
                      <span className="text-xs text-muted-foreground">{kind.description}</span>
                    </div>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={sortByDate} disabled={posts.length < 2}>
            <ArrowDownWideNarrow /> Trier par date de publication
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCollapse}>
            <PanelLeftClose /> Replier la colonne
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 /> Supprimer la colonne
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer la colonne « ${column.name} » ?`}
        description={
          posts.length
            ? "Elle contient encore des posts : déplace-les d'abord vers une autre colonne."
            : "La colonne est vide, elle sera supprimée."
        }
        confirmLabel="Supprimer"
        onConfirm={() => report(deleteTag("columns", column.id))}
      />
    </>
  );
}

/** Ajout express : on tape le titre, Entrée crée le post et laisse le champ ouvert pour le suivant. */
function QuickAdd({ column }: { column: ColumnDTO }) {
  const { meta, openPost } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const value = title.trim();
    if (!value) return;
    startTransition(async () => {
      const result = await savePost({ ...emptyDraft(meta, { columnId: column.id }), title: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      toast.success("Post ajouté", { action: { label: "Ouvrir", onClick: () => openPost(result.data.id) } });
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
      >
        <Plus className="size-4" /> Ajouter un post
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-card p-2 shadow-xs">
      <Textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            add();
          }
          if (e.key === "Escape") {
            setTitle("");
            setOpen(false);
          }
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        placeholder="Titre du post…"
        aria-label={`Titre du nouveau post dans ${column.name}`}
        className="min-h-12 resize-none border-0 p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Entrée pour ajouter · Échap pour fermer</span>
        <Button size="sm" className="ml-auto h-7" onClick={add} disabled={pending || !title.trim()}>
          {pending && <Loader2 className="animate-spin" />} Ajouter
        </Button>
      </div>
    </div>
  );
}

export function BoardColumn({
  column,
  itemKeys,
  total,
  postsById,
  onCollapse,
}: {
  column: ColumnDTO;
  itemKeys: string[];
  total: number;
  postsById: Map<number, PostDTO>;
  onCollapse: () => void;
}) {
  const { newPost } = useApp();
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column.id) });
  const [renaming, setRenaming] = useState(false);
  const columnPosts = itemKeys.flatMap((key) => postsById.get(Number(key.split("-")[1])) ?? []);

  return (
    <section
      id={columnKey(column.id)}
      aria-label={column.name}
      className="flex h-full w-[min(85vw,18rem)] shrink-0 snap-center flex-col rounded-xl bg-column md:w-72"
    >
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-2">
        <ColorDot color={column.color} className="size-2.5" />
        <div className="min-w-0">
          <ColumnTitle column={column} editing={renaming} onEditingChange={setRenaming} />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {itemKeys.length !== total ? `${itemKeys.length}/${total}` : total}
        </span>
        <div className="ml-auto flex shrink-0">
          <Hint label="Nouveau post dans cette colonne">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => newPost({ columnId: column.id })}
              aria-label={`Nouveau post dans ${column.name}`}
            >
              <Plus />
            </Button>
          </Hint>
          <ColumnMenu
            column={column}
            posts={columnPosts}
            onRename={() => setRenaming(true)}
            onCollapse={onCollapse}
          />
        </div>
      </div>
      <SortableContext items={itemKeys} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-b-xl px-2 pb-2 transition-colors",
            isOver && "bg-primary/5",
          )}
        >
          {columnPosts.map((post) => (
            <BoardCard key={post.id} post={post} />
          ))}
          {itemKeys.length === 0 && (
            <div className="rounded-lg border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
              {total ? "Aucun post ne correspond aux filtres" : "Glisse un post ici"}
            </div>
          )}
          <QuickAdd column={column} />
        </div>
      </SortableContext>
    </section>
  );
}

/** Colonne repliée : une bande étroite qui reste une zone de dépôt. */
export function CollapsedColumn({
  column,
  count,
  onExpand,
}: {
  column: ColumnDTO;
  count: number;
  onExpand: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column.id) });
  return (
    <Hint label={`Déplier « ${column.name} »`}>
      <button
        ref={setNodeRef}
        id={columnKey(column.id)}
        type="button"
        onClick={onExpand}
        className={cn(
          "flex h-full w-11 shrink-0 snap-center flex-col items-center gap-2 rounded-xl bg-column py-3 text-sm font-semibold transition-colors hover:bg-accent",
          isOver && "bg-primary/10 ring-2 ring-primary/40",
        )}
        aria-label={`${column.name}, ${count} post${count > 1 ? "s" : ""} (repliée)`}
      >
        <ColorDot color={column.color} className="size-2.5" />
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
        <span className="[writing-mode:vertical-rl]">{column.name}</span>
      </button>
    </Hint>
  );
}

/** « + Colonne » en fin de tableau. */
export function AddColumn() {
  const { meta } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const value = name.trim();
    if (!value) return;
    startTransition(async () => {
      const color = TAG_COLORS[meta.columns.length % TAG_COLORS.length];
      const result = await createTag("columns", { name: value, color });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setName("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-56 shrink-0 items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:bg-column hover:text-foreground"
      >
        <Plus className="size-4" /> Ajouter une colonne
      </button>
    );
  }
  return (
    <div className="flex w-64 shrink-0 flex-col gap-2 self-start rounded-xl bg-column p-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Nom de la colonne"
        aria-label="Nom de la nouvelle colonne"
        className="h-8"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button size="sm" onClick={add} disabled={pending || !name.trim()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
