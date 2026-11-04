"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { AssetThumb } from "@/components/library/asset-thumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FRAME_DEFAULTS, guessFrame, type SlideImage } from "@/lib/carousel";
import type { AssetDTO } from "@/lib/types";
import {
  CAPTURE_DEVICES,
  CAPTURE_MODES,
  displayUrl,
  normalizeUrl,
  type CaptureDevice,
  type CaptureMode,
} from "@/lib/web";

import { libraryImageUrl, loadMockup } from "./render-slide";
import { Segmented } from "./studio-ui";

type Capture = { assetId: number; width: number; height: number; url: string; device: CaptureDevice };

/** Image d'une slide avec le cadre et la position adaptés à sa forme. */
export function slideImageFor(
  assetId: number,
  ratio: number,
  { url = "", element = false }: { url?: string; element?: boolean } = {},
): SlideImage {
  const frame = guessFrame(ratio, { element });
  return { assetId, ratio, frame, url, label: "", ...FRAME_DEFAULTS[frame] };
}

/** Adresse d'une capture faite par l'app (notée dans ses notes : « Capture de https://… »). */
export function captureUrl(asset: Pick<AssetDTO, "notes">) {
  const match = asset.notes.match(/Capture de (https?:\/\/\S+?)[\s,(]/);
  return match ? displayUrl(match[1]) : "";
}

/**
 * Choix de l'image d'une slide : capture d'une page web (rangée dans la
 * médiathèque) ou image déjà dans la médiathèque, les captures d'abord.
 */
export function SlideImagePicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (image: SlideImage) => void;
}) {
  const { meta } = useApp();
  const router = useRouter();
  const [url, setUrl] = useState(() => meta.site.url || meta.ai.web.siteUrl);
  const [device, setDevice] = useState<CaptureDevice>("mobile");
  const [mode, setMode] = useState<CaptureMode>("page");
  const [focusText, setFocusText] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const images = meta.library
    .filter((a) => a.mimeType.startsWith("image/") && a.category !== "mockup")
    .sort((a, b) => Number(b.category === "screenshot") - Number(a.category === "screenshot") || b.createdAt - a.createdAt);

  async function capture() {
    const target = normalizeUrl(url);
    if (!target) {
      toast.error("Adresse invalide (ex. tamarque.fr/tarifs).");
      return;
    }
    if (mode === "element" && !focusText.trim()) {
      toast.error("Indique un texte du bloc à capturer (ex. « Pack Visibilité »).");
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setCapturing(true);
    try {
      const res = await fetch("/api/web/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target, device, mode, focusText }),
        signal: controller.signal,
      });
      const body = (await res.json().catch(() => null)) as { capture?: Capture; error?: string } | null;
      if (!res.ok || !body?.capture) {
        toast.error(body?.error ?? "La capture a échoué.");
        return;
      }
      const { assetId, width, height } = body.capture;
      onPick(slideImageFor(assetId, width / height, { url: displayUrl(body.capture.url), element: mode === "element" }));
      toast.success("Capture ajoutée à la slide (et rangée dans la médiathèque)");
      router.refresh();
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) toast.error("La capture a échoué.");
    } finally {
      setCapturing(false);
      controllerRef.current = null;
    }
  }

  async function pickAsset(asset: AssetDTO) {
    setLoadingId(asset.id);
    try {
      const img = await loadMockup(libraryImageUrl(asset.id));
      onPick(slideImageFor(asset.id, img.naturalWidth / img.naturalHeight, { url: captureUrl(asset) }));
    } catch {
      toast.error("Image illisible.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (open) return;
        controllerRef.current?.abort();
        onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Image de la slide</DialogTitle>
          <DialogDescription>
            Une capture de ton site (dans un cadre de navigateur ou de téléphone), ou une image de la médiathèque.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="capture" className="flex min-h-0 flex-1 flex-col gap-3">
          <TabsList className="self-start">
            <TabsTrigger value="capture">Capturer une page</TabsTrigger>
            <TabsTrigger value="library">Médiathèque</TabsTrigger>
          </TabsList>

          <TabsContent value="capture" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capture-url">Adresse de la page</Label>
              <Input
                id="capture-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="tamarque.fr/equipe"
                disabled={capturing}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Écran</span>
                <Segmented label="Type d'écran" value={device} options={CAPTURE_DEVICES} onChange={setDevice} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Cadrage</span>
                <Segmented label="Cadrage de la capture" value={mode} options={CAPTURE_MODES} onChange={setMode} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capture-focus">
                {mode === "element" ? "Texte du bloc à capturer" : "Texte à montrer (facultatif)"}
              </Label>
              <Input
                id="capture-focus"
                value={focusText}
                onChange={(e) => setFocusText(e.target.value)}
                placeholder={mode === "element" ? "Ex. : Pack Visibilité Express" : "Ex. : Tarifs — la page défile jusqu'à ce texte"}
                disabled={capturing}
              />
              <p className="text-xs text-muted-foreground">
                {mode === "element"
                  ? "La capture garde seulement la carte ou l'encadré qui contient ce texte."
                  : "Sans texte, c'est le haut de la page qui est capturé."}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              {capturing && (
                <span className="text-xs text-muted-foreground">Ouverture de la page… (quelques secondes)</span>
              )}
              <Button onClick={() => void capture()} disabled={capturing || !url.trim()}>
                {capturing ? <Loader2 className="animate-spin" /> : <Camera />} Capturer
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="library" className="min-h-0 flex-1 overflow-y-auto">
            {images.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aucune image dans la médiathèque : fais une capture ou importe une image dans Marque › Médiathèque.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 p-0.5 sm:grid-cols-4">
                {images.map((asset) => (
                  <li key={asset.id}>
                    <button
                      type="button"
                      onClick={() => void pickAsset(asset)}
                      disabled={loadingId !== null}
                      title={asset.title}
                      className="group relative flex w-full flex-col gap-1 rounded-md text-left"
                    >
                      <span className="relative block aspect-square w-full overflow-hidden rounded-md border-2 border-transparent bg-muted transition group-hover:border-primary">
                        <AssetThumb asset={asset} className="size-full object-top" />
                        {loadingId === asset.id && (
                          <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                            <Loader2 className="size-5 animate-spin" />
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{asset.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
