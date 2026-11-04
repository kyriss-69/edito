"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AssetFilters, AssetGrid, useAssetFilters } from "./asset-grid";

/** Sélection de médias de la bibliothèque (dans l'ordre des clics). */
export function LibraryPicker({
  onClose,
  onConfirm,
  pending,
}: {
  onClose: () => void;
  onConfirm: (assetIds: number[]) => void;
  pending?: boolean;
}) {
  const { meta } = useApp();
  const filters = useAssetFilters(meta.library);
  const [selected, setSelected] = useState<number[]>([]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Ajouter depuis la bibliothèque</DialogTitle>
          <DialogDescription>
            Clique sur les médias à ajouter, dans l&apos;ordre voulu. Ils sont copiés dans le post.
          </DialogDescription>
        </DialogHeader>
        <AssetFilters assets={meta.library} {...filters} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AssetGrid
            assets={filters.visible}
            selectedIds={selected}
            onSelect={(asset) =>
              setSelected((prev) =>
                prev.includes(asset.id) ? prev.filter((id) => id !== asset.id) : [...prev, asset.id],
              )
            }
            emptyLabel="La bibliothèque est vide pour ces filtres."
          />
        </div>
        <DialogFooter className="items-center">
          <Button variant="link" size="sm" className="mr-auto" asChild>
            <Link href="/brand/media" onClick={onClose}>
              Gérer la bibliothèque
            </Link>
          </Button>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={!selected.length || pending}>
            <Plus /> Ajouter {selected.length || ""} média{selected.length > 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
