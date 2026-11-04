"use client";

import { ArrowRightLeft, Trash2, X } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ColumnDTO } from "@/lib/types";
import { bulkDeletePosts, bulkMovePosts } from "@/server/actions";

/** Barre d'actions de la sélection multiple. */
export function BulkBar({ ids, onClear }: { ids: number[]; onClear: () => void }) {
  const { meta } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = `${ids.length} post${ids.length > 1 ? "s" : ""}`;

  function move(column: ColumnDTO) {
    startTransition(async () => {
      await bulkMovePosts(ids, column.id);
      toast.success(`${label} déplacé${ids.length > 1 ? "s" : ""} vers ${column.name}`);
      onClear();
    });
  }

  function remove() {
    startTransition(async () => {
      await bulkDeletePosts(ids);
      toast.success(`${label} supprimé${ids.length > 1 ? "s" : ""}`);
      onClear();
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Actions sur la sélection"
      className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-popover p-1.5 pl-3 shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
    >
      <span className="mr-1 text-sm font-medium whitespace-nowrap">
        {label} sélectionné{ids.length > 1 ? "s" : ""}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            <ArrowRightLeft /> Déplacer
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top">
          {meta.columns.map((column) => (
            <DropdownMenuItem key={column.id} onSelect={() => move(column)}>
              <ColorDot color={column.color} />
              {column.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmDelete(true)}
        disabled={pending}
      >
        <Trash2 /> Supprimer
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Annuler la sélection">
        <X />
      </Button>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Supprimer ${label} ?`}
        description="Les posts et leurs médias seront définitivement supprimés."
        confirmLabel="Supprimer"
        onConfirm={remove}
      />
    </div>
  );
}
