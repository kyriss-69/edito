"use client";

import {
  ArrowRightLeft,
  CalendarClock,
  ClipboardCopy,
  CopyPlus,
  PanelRightOpen,
  Trash2,
} from "lucide-react";
import { createContext, useContext } from "react";

import { useApp } from "@/components/app-provider";
import { ColorDot } from "@/components/posts/platform-badge";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { BoardDensity } from "@/lib/preferences";
import type { ColumnDTO, PostDTO } from "@/lib/types";

/** Actions sur un post depuis le tableau (menu « ⋯ », clic droit, barre de sélection). */
export type PostActions = {
  move: (post: PostDTO, column: ColumnDTO) => void;
  schedule: (post: PostDTO, scheduledAt: number | null) => void;
  duplicate: (post: PostDTO) => void;
  copyCaption: (post: PostDTO) => void;
  remove: (post: PostDTO) => void;
};

type BoardContextValue = {
  density: BoardDensity;
  now: number;
  selected: Set<number>;
  /** Ajoute ou retire un post de la sélection. */
  toggleSelected: (postId: number) => void;
  actions: PostActions;
};

export const BoardContext = createContext<BoardContextValue | null>(null);

export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("useBoard doit être utilisé dans le tableau");
  return value;
}

const MENUS = {
  dropdown: {
    Item: DropdownMenuItem,
    Separator: DropdownMenuSeparator,
    Sub: DropdownMenuSub,
    SubTrigger: DropdownMenuSubTrigger,
    SubContent: DropdownMenuSubContent,
  },
  context: {
    Item: ContextMenuItem,
    Separator: ContextMenuSeparator,
    Sub: ContextMenuSub,
    SubTrigger: ContextMenuSubTrigger,
    SubContent: ContextMenuSubContent,
  },
};

/** Entrées du menu d'un post, identiques dans le menu « ⋯ » et au clic droit. */
export function PostMenuItems({
  post,
  menu,
  onSchedule,
}: {
  post: PostDTO;
  menu: keyof typeof MENUS;
  /** Ouvre le choix de la date. */
  onSchedule: () => void;
}) {
  const { meta, openPost } = useApp();
  const { actions } = useBoard();
  const M = MENUS[menu];
  return (
    <>
      <M.Item onSelect={() => openPost(post.id)}>
        <PanelRightOpen /> Ouvrir
        {menu === "dropdown" && <DropdownMenuShortcut>↵</DropdownMenuShortcut>}
      </M.Item>
      <M.Item onSelect={onSchedule}>
        <CalendarClock /> {post.scheduledAt === null ? "Planifier…" : "Changer la date…"}
      </M.Item>
      <M.Sub>
        <M.SubTrigger>
          <ArrowRightLeft /> Déplacer vers
        </M.SubTrigger>
        <M.SubContent>
          {meta.columns.map((column) => (
            <M.Item
              key={column.id}
              disabled={column.id === post.columnId}
              onSelect={() => actions.move(post, column)}
            >
              <ColorDot color={column.color} />
              {column.name}
            </M.Item>
          ))}
        </M.SubContent>
      </M.Sub>
      <M.Item onSelect={() => actions.duplicate(post)}>
        <CopyPlus /> Dupliquer
      </M.Item>
      <M.Item onSelect={() => actions.copyCaption(post)} disabled={!post.caption.trim() && !post.hashtags.trim()}>
        <ClipboardCopy /> Copier la légende
      </M.Item>
      <M.Separator />
      <M.Item variant="destructive" onSelect={() => actions.remove(post)}>
        <Trash2 /> Supprimer
      </M.Item>
    </>
  );
}
