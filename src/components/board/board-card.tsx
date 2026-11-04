"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app-provider";
import { PostCard } from "@/components/posts/post-card";
import { SchedulePicker } from "@/components/posts/schedule-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { PostMenuItems, useBoard } from "./board-context";

export const postKey = (id: number) => `post-${id}`;

/** Empêche un clic sur une action de la carte de l'ouvrir ou de lancer un glisser-déposer. */
const stop = {
  onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
  onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
  onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
  onClick: (e: React.MouseEvent) => e.stopPropagation(),
  onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
};

const toolButton =
  "flex size-6 items-center justify-center rounded-md border bg-card text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground";

export function BoardCard({ post }: { post: PostDTO }) {
  const { openPost } = useApp();
  const { density, now, selected, toggleSelected, actions } = useBoard();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: postKey(post.id),
  });
  const [scheduling, setScheduling] = useState(false);
  const isSelected = selected.has(post.id);
  const selecting = selected.size > 0;

  // Ouvre le choix de la date une fois le menu refermé (sinon il se ferme aussitôt).
  const openSchedule = () => requestAnimationFrame(() => setScheduling(true));

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/board-card relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isDragging && "opacity-40",
      )}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || selecting) toggleSelected(post.id);
        else openPost(post.id);
      }}
      onKeyDown={(e) => {
        // Entrée ouvre le post ; Espace (géré par dnd-kit) le saisit pour le déplacer.
        if (e.key === "Enter") {
          e.preventDefault();
          openPost(post.id);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      aria-label={post.title}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <PostCard post={post} density={density} selected={isSelected} now={now}>
              <Popover open={scheduling} onOpenChange={setScheduling}>
                <PopoverTrigger asChild>
                  <button type="button" className={toolButton} aria-label="Planifier" title="Planifier" {...stop}>
                    <CalendarClock className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto" {...stop}>
                  <SchedulePicker value={post.scheduledAt} onChange={(value) => actions.schedule(post, value)} />
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={toolButton} aria-label="Actions du post" {...stop}>
                    <MoreHorizontal className="size-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  {...stop}
                >
                  <PostMenuItems post={post} menu="dropdown" onSchedule={openSchedule} />
                </DropdownMenuContent>
              </DropdownMenu>
            </PostCard>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56" onCloseAutoFocus={(e) => e.preventDefault()} {...stop}>
          <PostMenuItems post={post} menu="context" onSchedule={openSchedule} />
        </ContextMenuContent>
      </ContextMenu>

      <div
        className={cn(
          "absolute top-1.5 left-1.5 flex rounded bg-card/90 p-0.5 opacity-0 shadow-xs transition-opacity",
          "group-hover/board-card:opacity-100 focus-within:opacity-100",
          (selecting || isSelected) && "opacity-100",
        )}
        {...stop}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => toggleSelected(post.id)}
          aria-label={`Sélectionner « ${post.title} »`}
        />
      </div>
    </div>
  );
}
