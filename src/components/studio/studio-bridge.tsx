"use client";

import { ArrowRight, GalleryHorizontalEnd, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import {
  CAROUSEL_DESCRIPTION_MAX,
  defaultCarouselStyle,
  DEFAULT_SLIDE_COUNT,
  type CarouselStyle,
} from "@/lib/carousel";
import type { Draft } from "@/lib/post-draft";
import { createCarousel } from "@/server/actions";

import { detectMockupStyle, libraryImageUrl, loadMockup } from "./render-slide";

/**
 * Dans la fiche d'un post au format carrousel : créer ses slides dans le Studio
 * (le carrousel est lié au post, l'export remplacera ses images) ou les ouvrir.
 */
export function StudioBridge({
  postId,
  draft,
  ensurePostId,
  onLeave,
}: {
  postId: number | null;
  draft: Draft;
  ensurePostId: () => Promise<number | null>;
  /** Ferme la fiche avant d'aller dans le Studio. */
  onLeave: () => void;
}) {
  const { meta } = useApp();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const linked = postId === null ? undefined : meta.carousels.find((c) => c.postId === postId);

  if (draft.format !== "carousel") return null;

  function go(id: number) {
    onLeave();
    router.push(`/studio/${id}`);
  }

  function create() {
    startTransition(async () => {
      const id = await ensurePostId();
      if (!id) return;
      // Mockup du dernier carrousel, sinon le premier mockup de la médiathèque.
      const mockupAssetId =
        meta.carousels[0]?.mockupAssetId ?? meta.library.find((a) => a.category === "mockup")?.id ?? null;
      let style: Partial<CarouselStyle> | null = null;
      if (mockupAssetId !== null) {
        style = await loadMockup(libraryImageUrl(mockupAssetId))
          .then(detectMockupStyle)
          .catch(() => null);
      }
      const description = (draft.caption.trim() || draft.notes.trim() || draft.title.trim()).slice(
        0,
        CAROUSEL_DESCRIPTION_MAX,
      );
      const result = await createCarousel({
        title: draft.title.trim() || "Sans titre",
        description,
        slideCount: DEFAULT_SLIDE_COUNT,
        mockupAssetId,
        style: { ...defaultCarouselStyle(meta.brand), ...style },
        postId: id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      go(result.data.id);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <GalleryHorizontalEnd className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {linked ? "Slides du carrousel dans le Studio" : "Crée les slides de ce carrousel"}
        </p>
        <p className="text-xs text-muted-foreground">
          {linked
            ? `« ${linked.title} » · ${linked.slides.length} slides. L'export remplace les images du post.`
            : "Texte rédigé avec l'IA et posé sur ton mockup ; les images arrivent ensuite dans ce post."}
        </p>
      </div>
      {linked ? (
        <Button variant="outline" size="sm" onClick={() => go(linked.id)}>
          Ouvrir dans le Studio <ArrowRight />
        </Button>
      ) : (
        <Button size="sm" onClick={create} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <GalleryHorizontalEnd />} Créer dans le Studio
        </Button>
      )}
    </div>
  );
}
