"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { SaveIndicator, type SaveStatus } from "@/components/save-indicator";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CAROUSEL_DESCRIPTION_MAX,
  clampSlideCount,
  describeSlideImage,
  isSlideEmpty,
  MAX_SLIDES,
  MIN_SLIDES,
  resizeSlides,
  slideFileName,
  FRAME_DEFAULTS,
  textCapacity,
  type CarouselStyle,
  type Slide,
} from "@/lib/carousel";
import { APP_SHOTS_CATEGORY, appShotDescription } from "@/lib/app-shots";
import type { CarouselDTO } from "@/lib/types";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { deleteCarousel, prepareCarouselPost, removePostMedia, saveCarousel } from "@/server/actions";

import { CarouselAiWriter } from "./carousel-ai";
import {
  computeSlideLayout,
  detectMockupStyle,
  libraryImageUrl,
  loadMockup,
  loadSlideFonts,
  loadSlideImages,
  renderSlidePng,
} from "./render-slide";
import { SlideCanvas, useSlideAssets } from "./slide-canvas";
import { SlideEditor } from "./slide-editor";
import { StylePanel } from "./style-panel";
import { CharCount, StudioCard } from "./studio-ui";


type Draft = {
  title: string;
  description: string;
  mockupAssetId: number | null;
  slides: Slide[];
  style: CarouselStyle;
};

export function CarouselEditor({ id }: { id: number }) {
  const { meta } = useApp();
  const carousel = meta.carousels.find((c) => c.id === id);
  if (!carousel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
        Ce carrousel n&apos;existe pas (ou plus).
        <Button variant="outline" size="sm" asChild>
          <Link href="/studio">
            <ArrowLeft /> Retour au studio
          </Link>
        </Button>
      </div>
    );
  }
  return <Editor key={carousel.id} carousel={carousel} />;
}

/** Zone de texte de la slide affichée, en % de l'aperçu (réduite au-dessus de l'image s'il y en a une). */
function zoneBox(
  zone: { left: number; top: number; width: number; height: number } | null,
  style: CarouselStyle,
  size: { width: number; height: number },
): React.CSSProperties {
  if (!zone) {
    return {
      left: `${style.marginLeft}%`,
      right: `${style.marginRight}%`,
      top: `${style.marginTop}%`,
      bottom: `${style.marginBottom}%`,
    };
  }
  return {
    left: `${(zone.left / size.width) * 100}%`,
    width: `${(zone.width / size.width) * 100}%`,
    top: `${(zone.top / size.height) * 100}%`,
    height: `${(zone.height / size.height) * 100}%`,
  };
}

function draftOf(carousel: CarouselDTO): Draft {
  const { title, description, mockupAssetId, slides, style } = carousel;
  return { title, description, mockupAssetId, slides, style };
}

function Editor({ carousel }: { carousel: CarouselDTO }) {
  const { meta, posts, openPost } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftOf(carousel));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftOf(carousel)));
  const dirty = JSON.stringify(draft) !== baseline;
  const [selected, setSelected] = useState(0);
  const [, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [showZone, setShowZone] = useState(true);

  const mockup = meta.library.find((a) => a.id === draft.mockupAssetId);
  const assets = useSlideAssets(
    mockup?.url ?? null,
    draft.slides.flatMap((s) => (s.image ? [s.image.assetId] : [])),
  );
  const linkedPost = posts.find((p) => p.id === carousel.postId);
  // Réseau pour lequel l'IA rédige les slides : celui du post lié, sinon Instagram.
  const [aiPlatform, setAiPlatform] = useState<PlatformId | null>(
    () => linkedPost?.platforms[0]?.platform ?? "instagram",
  );
  const total = draft.slides.length;
  const current = Math.min(selected, total - 1);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const updateSlide = (index: number, slide: Slide) =>
    setDraft((prev) => ({ ...prev, slides: prev.slides.map((s, i) => (i === index ? slide : s)) }));

  // Mise en page de chaque slide, pour signaler un texte réduit ou trop long.
  const layouts = useMemo(() => {
    if (!assets.fonts) return [];
    const fonts = assets.fonts;
    return draft.slides.map((slide) => computeSlideLayout(slide, draft.style, assets.size, fonts));
  }, [assets.fonts, assets.size, draft.slides, draft.style]);

  // Enregistrement automatique : un enregistrement à la fois, toujours avec le dernier brouillon.
  const [status, setStatus] = useState<SaveStatus>("saved");
  const draftRef = useRef(draft);
  const savingRef = useRef<Promise<boolean> | null>(null);
  const deletedRef = useRef(false);
  useEffect(() => {
    draftRef.current = draft;
  });

  async function persist(): Promise<boolean> {
    while (savingRef.current) await savingRef.current;
    const snapshot = draftRef.current;
    const run = (async () => {
      setStatus("saving");
      const result = await saveCarousel({ id: carousel.id, ...snapshot });
      if (!result.ok) {
        setStatus("error");
        toast.error(result.error);
        return false;
      }
      setBaseline(JSON.stringify(snapshot));
      setStatus("saved");
      return true;
    })();
    savingRef.current = run;
    try {
      return await run;
    } finally {
      savingRef.current = null;
    }
  }

  function save() {
    void persist().then((ok) => ok && toast.success("Carrousel enregistré"));
  }

  const autosave = useEffectEvent(() => {
    if (!deletedRef.current) void persist();
  });
  const draftJson = JSON.stringify(draft);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(autosave, 1000);
    return () => clearTimeout(timer);
  }, [draftJson, dirty]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
    }
  });
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Prévient avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setCount(count: number) {
    const next = clampSlideCount(count);
    if (next === total) return;
    const removed = draft.slides.slice(next);
    if (removed.some((slide) => !isSlideEmpty(slide))) {
      setPendingCount(next);
      return;
    }
    update("slides", resizeSlides(draft.slides, next));
  }

  /** Dessine toutes les slides en PNG, à la taille réelle du mockup. */
  async function renderAll(): Promise<File[]> {
    const fonts = await loadSlideFonts(meta.brand);
    const image = mockup ? await loadMockup(mockup.url) : null;
    const images = await loadSlideImages(draft.slides);
    const files: File[] = [];
    for (const [index, slide] of draft.slides.entries()) {
      const blob = await renderSlidePng({ mockup: image, slide, style: draft.style, index, total, fonts, images });
      files.push(new File([blob], slideFileName(draft.title, index), { type: "image/png" }));
    }
    return files;
  }

  async function run(job: () => Promise<void>) {
    if (exporting) return;
    setExporting(true);
    try {
      if (dirty && !(await persist())) return;
      await job();
    } catch {
      toast.error("L'export a échoué. Vérifie que le mockup est bien une image lisible.");
    } finally {
      setExporting(false);
    }
  }

  function download() {
    void run(async () => {
      const files = await renderAll();
      for (const file of files) {
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      toast.success(`${files.length} image(s) téléchargée(s)`);
    });
  }

  function exportToPost() {
    void run(async () => {
      const files = await renderAll();
      const prepared = await prepareCarouselPost(carousel.id);
      if (!prepared.ok) {
        toast.error(prepared.error);
        return;
      }
      const { postId, previousMediaIds, created } = prepared.data;
      const body = new FormData();
      files.forEach((file) => body.append("files", file));
      const res = await fetch(`/api/posts/${postId}/media`, { method: "POST", body });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(data?.error ?? "L'envoi des images a échoué.");
        return;
      }
      await removePostMedia(postId, previousMediaIds);
      router.refresh();
      toast.success(
        created
          ? `Post créé dans le tableau avec ${files.length} slides`
          : `Images du post mises à jour (${files.length} slides)`,
        { action: { label: "Ouvrir le post", onClick: () => openPost(postId) } },
      );
    });
  }

  /** Place la zone de texte dans l'espace libre du mockup (au choix d'un mockup, ou sur demande). */
  async function fitToMockup(assetId: number | null, { silent = false } = {}) {
    if (assetId === null) return;
    try {
      const image = await loadMockup(libraryImageUrl(assetId));
      const fitted = detectMockupStyle(image);
      if (!fitted) {
        if (!silent) toast.error("Aucun espace libre assez grand trouvé sur ce mockup : règle les marges à la main.");
        return;
      }
      setDraft((prev) => ({ ...prev, style: { ...prev.style, ...fitted } }));
      toast.success("Zone de texte placée dans l'espace libre du mockup");
    } catch {
      if (!silent) toast.error("Mockup illisible.");
    }
  }

  const capacity = textCapacity(draft.style, assets.size);
  const capacities = draft.slides.map((slide) =>
    slide.image ? textCapacity(draft.style, assets.size, slide.image) : capacity,
  );
  // Écrans de l'app que l'IA peut poser sur les slides, et la place du texte qui leur reste.
  const screens = meta.library
    .filter((asset) => asset.category === APP_SHOTS_CATEGORY)
    .map((asset) => ({ id: asset.id, title: asset.title, description: appShotDescription(asset.notes) }));
  // La plus petite place parmi les cadres possibles (navigateur, carte, téléphone).
  const screenCapacity = (["browser", "card", "phone"] as const)
    .map((frame) =>
      textCapacity(draft.style, assets.size, {
        assetId: 1,
        ratio: frame === "phone" ? 0.5 : 1.6,
        frame,
        url: "",
        label: "",
        ...FRAME_DEFAULTS[frame],
      }),
    )
    .reduce((min, c) => ({ title: Math.min(min.title, c.title), body: Math.min(min.body, c.body) }));
  const context = {
    platform: aiPlatform,
    title: draft.title,
    description: draft.description,
    screens,
    screenCapacity,
    look: { kickers: meta.brand.studio.kickers, accent: Boolean(draft.style.accentColor) },
    slides: draft.slides.map((slide, i) => ({
      ...slide,
      visual: describeSlideImage(slide.image),
      capacity: slide.image ? capacities[i] : null,
    })),
    capacity,
  };

  return (
    <>
      <header className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-3 md:px-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/studio">
            <ArrowLeft /> <span className="max-sm:hidden">Studio</span>
          </Link>
        </Button>
        <Input
          value={draft.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="Titre du carrousel"
          aria-label="Titre du carrousel"
          className="h-9 max-w-md flex-1 border-transparent bg-transparent text-lg font-semibold shadow-none hover:border-input dark:bg-transparent"
        />
        <div className="ml-auto flex items-center gap-2">
          <SaveIndicator status={dirty && status !== "error" ? "saving" : status} onRetry={save} />
          {linkedPost && (
            <Button variant="ghost" size="sm" onClick={() => openPost(linkedPost.id)} title={linkedPost.title}>
              <ExternalLink /> <span className="max-sm:hidden">Voir le post</span>
            </Button>
          )}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin" /> : <Send />} Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => (linkedPost && linkedPost.media.length ? setConfirmUpdate(true) : exportToPost())}
              >
                <Send /> {linkedPost ? "Mettre à jour les images du post" : "Créer le post avec ces slides"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={download}>
                <Download /> Télécharger les images (PNG)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Plus d'actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Supprimer le carrousel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-7xl items-start gap-4 p-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
          <div className="flex min-w-0 flex-col gap-4">
            <StudioCard
              title="Le post"
              description="Décris précisément le post : l'IA s'appuie dessus (et sur le document de référence de la marque) pour chaque slide."
            >
              <Textarea
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Sujet, message clé, à qui il s'adresse, ce que la personne doit retenir ou faire après l'avoir vu. Ex. : Carrousel pour les micro-créateurs (1k-50k abonnés) qui pensent que les marques ne regardent que le nombre d'abonnés. Montrer que l'engagement compte plus, avec 4 conseils concrets pour le mettre en valeur, puis inviter à rejoindre les Créateurs Fondateurs."
                className={cn(
                  "min-h-28",
                  !draft.description.trim() && "border-warning/60 focus-visible:border-warning",
                )}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {draft.description.trim()
                    ? "Plus c'est précis, plus les slides seront justes."
                    : "Obligatoire pour que l'IA rédige les slides."}
                </span>
                <CharCount value={draft.description} max={CAROUSEL_DESCRIPTION_MAX} />
              </div>
            </StudioCard>

            <StudioCard
              title="Slides"
              description="Un titre court et, si besoin, un texte par slide. La première accroche, la dernière invite à agir."
              action={
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Nombre de slides</span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setCount(total - 1)}
                    disabled={total <= MIN_SLIDES}
                    aria-label="Une slide de moins"
                  >
                    <Minus />
                  </Button>
                  <Input
                    type="number"
                    min={MIN_SLIDES}
                    max={MAX_SLIDES}
                    value={total}
                    onChange={(e) => e.target.value && setCount(Number(e.target.value))}
                    className="h-8 w-14 text-center"
                    aria-label="Nombre de slides"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setCount(total + 1)}
                    disabled={total >= MAX_SLIDES}
                    aria-label="Une slide de plus"
                  >
                    <Plus />
                  </Button>
                </div>
              }
            >
              <CarouselAiWriter
                context={context}
                onPlatformChange={setAiPlatform}
                onApply={(slides) => update("slides", slides)}
              />
              <ol className="flex flex-col gap-3">
                {draft.slides.map((slide, index) => (
                  <SlideEditor
                    key={index}
                    index={index}
                    slide={slide}
                    total={total}
                    selected={index === current}
                    layout={layouts[index] ?? null}
                    context={context}
                    capacity={capacities[index]}
                    onSelect={() => setSelected(index)}
                    onChange={(next) => updateSlide(index, next)}
                  />
                ))}
              </ol>
            </StudioCard>
          </div>

          <div className="order-first flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:order-none lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-1">
            <StudioCard
              title={`Aperçu · slide ${current + 1} / ${total}`}
              action={
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={showZone}
                    onChange={(e) => setShowZone(e.target.checked)}
                    className="accent-primary"
                  />
                  Zone de texte
                </label>
              }
            >
              <div className="relative">
                <SlideCanvas
                  assets={assets}
                  slide={draft.slides[current]}
                  style={draft.style}
                  index={current}
                  total={total}
                  scale={0.6}
                  className="border"
                />
                {showZone && (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute border border-dashed border-primary/70"
                    style={zoneBox(layouts[current]?.zone ?? null, draft.style, assets.size)}
                  />
                )}
                {!assets.ready && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-y-0 left-1 flex items-center">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full opacity-80"
                    onClick={() => setSelected(Math.max(0, current - 1))}
                    disabled={current === 0}
                    aria-label="Slide précédente"
                  >
                    <ChevronLeft />
                  </Button>
                </div>
                <div className="absolute inset-y-0 right-1 flex items-center">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full opacity-80"
                    onClick={() => setSelected(Math.min(total - 1, current + 1))}
                    disabled={current === total - 1}
                    aria-label="Slide suivante"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
              <ol className="flex gap-1.5 overflow-x-auto pb-1">
                {draft.slides.map((slide, index) => (
                  <li key={index} className="w-14 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(index);
                        document.getElementById(`slide-${index}-title`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                      aria-label={`Afficher la slide ${index + 1}`}
                      aria-current={index === current}
                      className={cn(
                        "block w-full overflow-hidden rounded border-2",
                        index === current ? "border-primary" : "border-transparent",
                      )}
                    >
                      <SlideCanvas assets={assets} slide={slide} style={draft.style} index={index} total={total} scale={0.1} className="rounded-none" />
                    </button>
                  </li>
                ))}
              </ol>
            </StudioCard>

            <StylePanel
              mockupAssetId={draft.mockupAssetId}
              onMockupChange={(assetId) => {
                update("mockupAssetId", assetId);
                void fitToMockup(assetId, { silent: true });
              }}
              onFitToMockup={() => void fitToMockup(draft.mockupAssetId)}
              mockupError={assets.mockupError}
              style={draft.style}
              onChange={(style) => update("style", style)}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingCount !== null}
        onOpenChange={(open) => !open && setPendingCount(null)}
        title="Retirer des slides ?"
        description="Les dernières slides contiennent du texte : il sera supprimé."
        confirmLabel="Retirer"
        onConfirm={() => {
          if (pendingCount !== null) update("slides", resizeSlides(draft.slides, pendingCount));
          setPendingCount(null);
        }}
      />
      <ConfirmDialog
        open={confirmUpdate}
        onOpenChange={setConfirmUpdate}
        title="Mettre à jour le post ?"
        description={`Les images actuelles du post « ${linkedPost?.title ?? ""} » seront remplacées par les ${total} slides.`}
        confirmLabel="Remplacer les images"
        destructive={false}
        onConfirm={exportToPost}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer ce carrousel ?"
        description="Le carrousel est supprimé du studio. Le post déjà créé et ses images sont conservés."
        confirmLabel="Supprimer"
        onConfirm={() =>
          startTransition(async () => {
            deletedRef.current = true;
            await deleteCarousel(carousel.id);
            setBaseline(JSON.stringify(draft));
            toast.success("Carrousel supprimé");
            router.push("/studio");
          })
        }
      />
    </>
  );
}
