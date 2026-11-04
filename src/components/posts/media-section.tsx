"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, Library, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { LibraryPicker } from "@/components/library/library-picker";
import { Button } from "@/components/ui/button";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import type { MediaDTO } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";
import { addLibraryAssetsToPost, deleteMedia, reorderMedia } from "@/server/actions";

import { MediaThumb } from "./post-card";
import { Section } from "./editor-section";

export function MediaSection({
  media,
  postId,
  ensurePostId,
  format,
  platforms,
  children,
}: {
  media: MediaDTO[];
  postId: number | null;
  ensurePostId: () => Promise<number | null>;
  format: string;
  platforms: PlatformId[];
  /** Affiché sous les médias (ex. l'analyse par l'assistant IA). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);

  const carouselLimit = platforms.length
    ? Math.min(...platforms.map((p) => PLATFORMS[p].carouselLimit))
    : null;
  const tooMany = format === "carousel" && carouselLimit !== null && media.length > carouselLimit;

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const id = await ensurePostId();
      if (!id) return;
      const body = new FormData();
      list.forEach((file) => body.append("files", file));
      const res = await fetch(`/api/posts/${id}/media`, { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Échec de l'envoi");
        return;
      }
      toast.success(list.length > 1 ? `${list.length} médias ajoutés` : "Média ajouté");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function addFromLibrary(assetIds: number[]) {
    startTransition(async () => {
      const id = await ensurePostId();
      if (!id) return;
      const result = await addLibraryAssetsToPost(id, assetIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.count > 1 ? `${result.data.count} médias ajoutés` : "Média ajouté");
      setPicking(false);
    });
  }

  // Ordre affiché pendant l'enregistrement d'un déplacement.
  const [order, setOrder] = useState<number[] | null>(null);
  const [syncedMedia, setSyncedMedia] = useState(media);
  if (syncedMedia !== media) {
    setSyncedMedia(media);
    setOrder(null);
  }
  const byId = new Map(media.map((m) => [m.id, m]));
  const shown = order ? order.flatMap((id) => byId.get(id) ?? []) : media;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (postId === null || !over || active.id === over.id) return;
    const ids = shown.map((m) => m.id);
    const next = arrayMove(ids, ids.indexOf(Number(active.id)), ids.indexOf(Number(over.id)));
    setOrder(next);
    startTransition(() => reorderMedia(postId, next).then(() => undefined));
  }

  function remove(id: number) {
    startTransition(async () => {
      const result = await deleteMedia(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Section
      title="Médias"
      description={
        format === "carousel" && carouselLimit
          ? `Carrousel : ${media.length} / ${carouselLimit} médias max`
          : "Le premier média sert de couverture. Glisse-les pour changer l'ordre."
      }
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
            <Library /> Bibliothèque
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Ajouter
          </Button>
        </div>
      }
    >
      {picking && (
        <LibraryPicker onClose={() => setPicking(false)} onConfirm={addFromLibrary} pending={pending} />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => e.target.files && upload(e.target.files)}
      />
      {tooMany && (
        <p className="text-xs font-medium text-destructive">
          Trop de médias pour un carrousel sur les réseaux sélectionnés (max {carouselLimit}).
        </p>
      )}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-3 transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border",
          pending && "opacity-60",
        )}
      >
        {media.length === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Upload className="size-5 text-primary" />
            </span>
            <span className="font-medium text-foreground">Commence par ta photo ou ta vidéo</span>
            <span className="max-w-sm text-xs">
              Glisse tes fichiers ici ou clique pour choisir. L&apos;assistant IA pourra ensuite
              proposer le titre, la légende, les hashtags et l&apos;appel à l&apos;action.
            </span>
          </button>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={shown.map((m) => m.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {shown.map((m, index) => (
                  <SortableMedia key={m.id} media={m} cover={index === 0} onRemove={() => remove(m.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
      {children}
    </Section>
  );
}

function SortableMedia({ media, cover, onRemove }: { media: MediaDTO; cover: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group relative overflow-hidden rounded-md border bg-muted", isDragging && "z-10 opacity-70 shadow-lg")}
    >
      <div
        className="cursor-grab touch-none active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label={`Déplacer ${media.originalName}`}
      >
        <MediaThumb media={media} className="aspect-square w-full" />
      </div>
      {cover && (
        <span className="pointer-events-none absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          Couverture
        </span>
      )}
      <span className="pointer-events-none absolute top-1 right-1 rounded bg-black/50 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="size-3" />
      </span>
      <div className="absolute inset-x-0 bottom-6 flex justify-end gap-0.5 bg-gradient-to-t from-black/70 to-transparent p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton label="Ouvrir" onClick={() => window.open(media.url, "_blank")}>
          <ExternalLink />
        </IconButton>
        <IconButton label="Supprimer" onClick={onRemove}>
          <Trash2 />
        </IconButton>
      </div>
      <div className="truncate px-1.5 py-1 text-[10px] text-muted-foreground" title={media.originalName}>
        {formatBytes(media.size)} · {media.originalName}
      </div>
    </li>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-30 [&_svg]:size-3.5"
      {...props}
    >
      {children}
    </button>
  );
}
