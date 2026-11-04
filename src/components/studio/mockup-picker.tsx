"use client";

import { Check, ImageOff, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { AssetThumb } from "@/components/library/asset-thumb";
import { brandCarouselColors } from "@/lib/carousel";
import { cn } from "@/lib/utils";

/**
 * Choix du mockup d'un carrousel parmi les images de la bibliothèque (les
 * mockups d'abord), ou import d'un nouveau PNG, rangé dans la catégorie « Mockups ».
 */
export function MockupPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (assetId: number | null) => void;
}) {
  const { meta } = useApp();
  const blank = brandCarouselColors(meta.brand);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const images = meta.library
    // Les captures (écrans de l'app, pages web) se posent sur les slides, pas en fond.
    .filter((a) => a.mimeType.startsWith("image/") && a.category !== "app" && a.category !== "screenshot")
    .sort((a, b) => Number(b.category === "mockup") - Number(a.category === "mockup"));

  async function upload(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("files", file);
      body.append("category", "mockup");
      const res = await fetch("/api/library", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as { ids?: number[]; error?: string } | null;
      if (!res.ok || !data?.ids?.length) {
        toast.error(data?.error ?? "Échec de l'import");
        return;
      }
      onChange(data.ids[0]);
      toast.success("Mockup ajouté à la bibliothèque");
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <ul className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-0.5 sm:grid-cols-5">
        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <Upload className="size-5" />}
            Importer un PNG
          </button>
        </li>
        <li>
          <Choice selected={value === null} onClick={() => onChange(null)} label="Sans mockup (fond uni)">
            <span
              className="flex size-full items-center justify-center"
              style={{ backgroundColor: blank.background, color: `${blank.textColor}80` }}
            >
              <ImageOff className="size-5" />
            </span>
          </Choice>
        </li>
        {images.map((asset) => (
          <li key={asset.id}>
            <Choice selected={value === asset.id} onClick={() => onChange(asset.id)} label={asset.title}>
              <AssetThumb asset={asset} className="size-full" />
            </Choice>
          </li>
        ))}
      </ul>
      {images.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Importe ton mockup (PNG) : il sera aussi rangé dans la bibliothèque, catégorie « Mockups ».
        </p>
      )}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  label,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "relative aspect-[4/5] w-full overflow-hidden rounded-md border-2 bg-muted transition",
        selected ? "border-primary" : "border-transparent hover:border-border",
      )}
    >
      {children}
      {selected && (
        <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
    </button>
  );
}
