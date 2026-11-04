"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Download, ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSET_CATEGORIES } from "@/lib/library";
import type { AssetDTO } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";
import { deleteAsset, updateAsset } from "@/server/actions";

import { AppShotsButton } from "./app-shots-button";
import { AssetFilters, AssetGrid, useAssetFilters } from "./asset-grid";
import { AssetThumb } from "./asset-thumb";

function AssetDialog({ asset, onClose }: { asset: AssetDTO; onClose: () => void }) {
  const [title, setTitle] = useState(asset.title);
  const [category, setCategory] = useState(asset.category);
  const [notes, setNotes] = useState(asset.notes);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = title !== asset.title || category !== asset.category || notes !== asset.notes;

  function save() {
    startTransition(async () => {
      const result = await updateAsset(asset.id, { title, category, notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Média enregistré");
      onClose();
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteAsset(asset.id);
      toast.success("Média supprimé");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{asset.title}</DialogTitle>
          <DialogDescription>
            {asset.originalName} · {formatBytes(asset.size)} · ajouté le{" "}
            {format(asset.createdAt, "d MMMM yyyy", { locale: fr })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="overflow-hidden rounded-lg border bg-muted">
            {asset.mimeType.startsWith("video/") ? (
              <video src={asset.url} controls className="max-h-[60vh] w-full" />
            ) : (
              <AssetThumb asset={asset} className="max-h-[60vh] w-full object-contain" />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-title" className="text-xs text-muted-foreground">
                Titre
              </Label>
              <Input id="asset-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-category" className="text-xs text-muted-foreground">
                Catégorie
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="asset-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="asset-notes" className="text-xs text-muted-foreground">
                Notes
              </Label>
              <Textarea
                id="asset-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Usage, crédits, version…"
                className="min-h-20"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href={asset.url} target="_blank" rel="noreferrer">
                  <ExternalLink /> Ouvrir
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`${asset.url}&download=1`}>
                  <Download /> Télécharger
                </a>
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="items-center">
          <Button
            variant="ghost"
            size="sm"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => setConfirm(true)}
            disabled={pending}
          >
            <Trash2 /> Supprimer
          </Button>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={save} disabled={!dirty || pending || !title.trim()}>
            Enregistrer
          </Button>
        </DialogFooter>
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Supprimer ce média ?"
          description="Il disparaît de la bibliothèque. Les posts qui l'utilisent gardent leur propre copie."
          confirmLabel="Supprimer"
          onConfirm={remove}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Envoie des fichiers dans la médiathèque. */
export function useLibraryUpload() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  async function upload(files: FileList | File[], category?: string) {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      const body = new FormData();
      list.forEach((f) => body.append("files", f));
      if (category && category !== "all") body.append("category", category);
      const res = await fetch("/api/library", { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "Échec de l'envoi");
        return;
      }
      toast.success(list.length > 1 ? `${list.length} médias ajoutés` : "Média ajouté");
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return { upload, uploading };
}

export function MediaLibrary() {
  const { meta } = useApp();
  const filters = useAssetFilters(meta.library);
  const [openId, setOpenId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useLibraryUpload();
  const open = meta.library.find((a) => a.id === openId);

  return (
    <div
      className={cn("mx-auto flex max-w-6xl flex-col gap-4 rounded-xl", dragOver && "ring-2 ring-primary")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void upload(e.dataTransfer.files, filters.category);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AssetFilters assets={meta.library} {...filters} />
        <div className="flex flex-wrap gap-2">
          {meta.workspace.appShots && <AppShotsButton config={meta.workspace.appShots} />}
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          Ajouter des médias
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files, filters.category);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Glisse des fichiers ici pour les ajouter
        {filters.category !== "all" && " dans la catégorie sélectionnée"}. Clique sur un média pour le renommer, le
        classer ou le télécharger.
      </p>
      <AssetGrid
        assets={filters.visible}
        onSelect={(asset) => setOpenId(asset.id)}
        emptyLabel="Aucun média ne correspond."
      />
      {open && <AssetDialog key={open.id} asset={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
