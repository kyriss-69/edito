"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { GalleryHorizontalEnd, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { PageHeader } from "@/components/page-header";
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
import { Textarea } from "@/components/ui/textarea";
import {
  clampSlideCount,
  defaultCarouselStyle,
  DEFAULT_SLIDE_COUNT,
  MAX_SLIDES,
  MIN_SLIDES,
  type CarouselStyle,
} from "@/lib/carousel";
import type { CarouselDTO } from "@/lib/types";
import { createCarousel } from "@/server/actions";

import { MockupPicker } from "./mockup-picker";
import { detectMockupStyle, libraryImageUrl, loadMockup } from "./render-slide";
import { SlideCanvas, useSlideAssets } from "./slide-canvas";

export function StudioView() {
  const { meta } = useApp();
  const router = useRouter();
  // « Créer › Nouveau carrousel » arrive ici avec ?new=1.
  const requested = useSearchParams().get("new") === "1";
  const [opened, setOpened] = useState(false);
  const creating = opened || requested;

  function setCreating(open: boolean) {
    setOpened(open);
    if (!open && requested) router.replace("/studio");
  }

  return (
    <>
      <PageHeader title="Studio" description="Carrousels rédigés avec l'IA et posés sur tes mockups">
        <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="max-md:hidden">
          <Plus /> Nouveau carrousel
        </Button>
      </PageHeader>
      <div className="flex-1 overflow-y-auto p-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          {meta.carousels.length === 0 ? (
            <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <GalleryHorizontalEnd className="size-6 text-primary" />
              </span>
              <h2 className="font-semibold">Crée ton premier carrousel</h2>
              <p className="text-sm text-muted-foreground">
                Décris le post, choisis ton mockup (PNG) et le nombre de slides. Tu écris le texte de chaque
                slide, l&apos;IA t&apos;aide à le rédiger, puis le studio pose le texte sur le mockup et crée le
                post avec les images.
              </p>
              <Button onClick={() => setCreating(true)}>
                <Plus /> Nouveau carrousel
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {meta.carousels.map((carousel) => (
                <CarouselCard key={carousel.id} carousel={carousel} />
              ))}
            </ul>
          )}
        </div>
      </div>
      {creating && <NewCarouselDialog onClose={() => setCreating(false)} />}
    </>
  );
}

function CarouselCard({ carousel }: { carousel: CarouselDTO }) {
  const { meta, posts } = useApp();
  const mockup = meta.library.find((a) => a.id === carousel.mockupAssetId);
  const cover = carousel.slides[0];
  const assets = useSlideAssets(mockup?.url ?? null, cover?.image ? [cover.image.assetId] : []);
  const post = posts.find((p) => p.id === carousel.postId);

  return (
    <li>
      <Link
        href={`/studio/${carousel.id}`}
        className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
      >
        <SlideCanvas
          assets={assets}
          slide={carousel.slides[0]}
          style={carousel.style}
          index={0}
          total={carousel.slides.length}
          scale={0.25}
          className="rounded-none"
        />
        <div className="flex flex-col gap-1 p-3">
          <span className="truncate text-sm font-semibold">{carousel.title}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{carousel.description}</span>
          <span className="text-[11px] text-muted-foreground">
            {carousel.slides.length} slides · modifié le {format(carousel.updatedAt, "d MMM", { locale: fr })}
            {post && " · post créé"}
          </span>
        </div>
      </Link>
    </li>
  );
}

function NewCarouselDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { meta } = useApp();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [count, setCount] = useState(DEFAULT_SLIDE_COUNT);
  const [mockupAssetId, setMockupAssetId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const canCreate = title.trim() && description.trim();

  function create() {
    if (!canCreate) return;
    startTransition(async () => {
      // Zone de texte placée dans l'espace libre du mockup.
      let style: Partial<CarouselStyle> | null = null;
      if (mockupAssetId !== null) {
        style = await loadMockup(libraryImageUrl(mockupAssetId))
          .then(detectMockupStyle)
          .catch(() => null);
      }
      const result = await createCarousel({
        title,
        description,
        slideCount: clampSlideCount(count),
        mockupAssetId,
        style: { ...defaultCarouselStyle(meta.brand), ...style },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(`/studio/${result.data.id}`);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouveau carrousel</DialogTitle>
          <DialogDescription>
            La description du post sert à l&apos;IA pour rédiger chaque slide : sois précis.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 flex flex-col gap-4 overflow-y-auto px-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carousel-title">Titre</Label>
            <Input
              id="carousel-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. : 4 façons de mettre ton engagement en avant"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carousel-description">Description du post</Label>
            <Textarea
              id="carousel-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Le sujet, le message clé, à qui il s'adresse, ce que la personne doit retenir ou faire après l'avoir vu."
              className="min-h-28"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carousel-count">Nombre de slides</Label>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCount((c) => clampSlideCount(c - 1))}
                disabled={count <= MIN_SLIDES}
                aria-label="Une slide de moins"
              >
                <Minus />
              </Button>
              <Input
                id="carousel-count"
                type="number"
                min={MIN_SLIDES}
                max={MAX_SLIDES}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                onBlur={() => setCount((c) => clampSlideCount(c))}
                className="h-8 w-16 text-center"
              />
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setCount((c) => clampSlideCount(c + 1))}
                disabled={count >= MAX_SLIDES}
                aria-label="Une slide de plus"
              >
                <Plus />
              </Button>
              <span className="text-xs text-muted-foreground">Modifiable ensuite (jusqu&apos;à {MAX_SLIDES}).</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Mockup</Label>
            <MockupPicker value={mockupAssetId} onChange={setMockupAssetId} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={create} disabled={!canCreate || pending}>
            {pending && <Loader2 className="animate-spin" />} Créer le carrousel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
