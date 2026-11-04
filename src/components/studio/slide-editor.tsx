"use client";

import { AlertTriangle, Check, ImagePlus, RefreshCw, Replace, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AiError, AiIcon, AiProgress } from "@/components/ai/ai-progress";
import { useApp } from "@/components/app-provider";
import { AssistantPanel, useAiReady } from "@/components/ai/caption-assistant";
import { useAiTask } from "@/components/ai/use-ai-task";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FRAME_DEFAULTS,
  IMAGE_FRAMES,
  isSlideEmpty,
  SLIDE_ROLE_LABELS,
  SLIDE_LIMITS,
  slideRole,
  stripEmphasis,
  type Slide,
  type SlideImage,
  type SlideLayout,
} from "@/lib/carousel";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

import { libraryImageUrl } from "./render-slide";
import { SlideImagePicker } from "./slide-image-picker";
import { CharCount, RangeField } from "./studio-ui";

/** Ce que l'IA doit savoir du carrousel pour rédiger une slide. */
export type CarouselAiContext = {
  title: string;
  description: string;
  /** Slides, avec la description de leur image et la place du texte quand une image en prend. */
  slides: (Slide & { visual: string; capacity: { title: number; body: number } | null })[];
  /** Place disponible dans la zone de texte du mockup, en caractères. */
  capacity: { title: number; body: number };
  /** Écrans de l'app que l'IA peut poser sur les slides (carrousel entier). */
  screens?: { id: number; title: string; description: string }[];
  screenCapacity?: { title: number; body: number } | null;
  /** Réseau pour lequel l'IA écrit (sinon un texte valable partout). */
  platform: PlatformId | null;
  /** Mise en page : kicker et source par slide, mots du titre en couleur d'accent. */
  look: { kickers: boolean; accent: boolean };
};

export function SlideEditor({
  index,
  slide,
  total,
  selected,
  layout,
  context,
  capacity,
  onSelect,
  onChange,
}: {
  index: number;
  slide: Slide;
  total: number;
  selected: boolean;
  layout: SlideLayout | null;
  context: CarouselAiContext;
  /** Place du texte sur cette slide (réduite par l'image). */
  capacity: { title: number; body: number };
  onSelect: () => void;
  onChange: (slide: Slide) => void;
}) {
  const { meta } = useApp();
  // Kicker et note de source : proposés quand la charte en prévoit (ou déjà remplis).
  const extras = meta.brand.studio.kickers || Boolean(slide.kicker || slide.source);
  const ready = useAiReady();
  const task = useAiTask("carouselSlide");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [picking, setPicking] = useState(false);
  const role = slideRole(index, total);
  const empty = isSlideEmpty(slide);

  function propose() {
    if (!context.description.trim()) {
      toast.error("Décris d'abord le post (en haut) : l'IA s'en sert pour rédiger chaque slide.");
      return;
    }
    if (!ready()) return;
    onSelect();
    setOpen(true);
    void task.run({ ...context, index, instruction });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  return (
    <li
      onFocusCapture={onSelect}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 transition-shadow",
        selected && "ring-2 ring-primary/60",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <span className="text-xs font-medium text-muted-foreground">{SLIDE_ROLE_LABELS[role]}</span>
        {layout?.overflow ? (
          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3.5" /> Trop long : raccourcis le texte ou agrandis la zone
          </span>
        ) : (
          layout?.shrunk && (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="size-3.5" /> Texte réduit pour tenir dans la zone
            </span>
          )
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={propose}>
          <AiIcon /> {empty ? "Rédiger avec l'IA" : "Améliorer avec l'IA"}
        </Button>
      </div>

      {extras && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Kicker (petit titre en capitales, au-dessus)</span>
          <Input
            value={slide.kicker}
            onChange={(e) => onChange({ ...slide, kicker: e.target.value.slice(0, SLIDE_LIMITS.kicker) })}
            placeholder="Ex. : Ton IA en local · épisode 2"
            className="h-8"
          />
        </label>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor={`slide-${index}-title`} className="text-xs text-muted-foreground">
            Titre <span className="opacity-70">(*mots* en couleur d&apos;accent)</span>
          </label>
          <CharCount value={stripEmphasis(slide.title)} max={capacity.title} />
        </div>
        <Textarea
          id={`slide-${index}-title`}
          value={slide.title}
          onChange={(e) => onChange({ ...slide, title: e.target.value })}
          placeholder={
            role === "cover"
              ? "L'accroche, ex. : 5 erreurs qui font fuir les marques"
              : role === "end"
                ? "Le résumé et une question, ou l'appel à l'action"
                : "L'idée de la slide"
          }
          className="min-h-10 font-semibold"
          rows={1}
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor={`slide-${index}-body`} className="text-xs text-muted-foreground">
            Texte
          </label>
          <CharCount value={slide.body} max={capacity.body} />
        </div>
        <Textarea
          id={`slide-${index}-body`}
          value={slide.body}
          onChange={(e) => onChange({ ...slide, body: e.target.value })}
          placeholder="Facultatif : une ou deux phrases courtes"
          className="min-h-16"
        />
      </div>
      {extras && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Note de source (en bas de la slide)</span>
          <Input
            value={slide.source}
            onChange={(e) => onChange({ ...slide, source: e.target.value.slice(0, SLIDE_LIMITS.source) })}
            placeholder="Ex. : Source : ollama.com, vérifié le 29/10/2026"
            className="h-8"
          />
        </label>
      )}

      {slide.image ? (
        <SlideImageControls
          image={slide.image}
          onChange={(image) => onChange({ ...slide, image })}
          onReplace={() => setPicking(true)}
        />
      ) : (
        <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setPicking(true)}>
          <ImagePlus /> Ajouter une image (capture du site…)
        </Button>
      )}
      {picking && (
        <SlideImagePicker
          onClose={() => setPicking(false)}
          onPick={(image) => {
            // Une image remplacée garde la position choisie si le cadre ne change pas.
            const previous = slide.image;
            const next =
              previous && previous.frame === image.frame
                ? { ...image, width: previous.width, x: previous.x, y: previous.y, rotation: previous.rotation }
                : image;
            onChange({ ...slide, image: next });
            onSelect();
            setPicking(false);
          }}
        />
      )}

      {open && (
        <AssistantPanel title={`Slide ${index + 1} : propositions`} onClose={close}>
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={propose} />}
          {task.state.status === "done" &&
            task.state.result.proposals.map((proposal, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded-md border bg-card p-3">
                {proposal.title && <p className="text-sm font-semibold whitespace-pre-wrap">{proposal.title}</p>}
                {proposal.body && <p className="text-sm whitespace-pre-wrap">{proposal.body}</p>}
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-end"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange({
                      ...slide,
                      title: proposal.title,
                      body: proposal.body,
                      kicker: proposal.kicker ?? slide.kicker,
                      source: proposal.source ?? slide.source,
                    });
                    toast.success(`Slide ${index + 1} mise à jour`);
                    close();
                  }}
                >
                  <Check /> Utiliser
                </Button>
              </div>
            ))}
          {task.state.status !== "running" && (
            <div className="flex gap-2">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    propose();
                  }
                }}
                placeholder="Précision (optionnel) : plus percutant, parle du 0 % de commission…"
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={propose}>
                <RefreshCw /> Relancer
              </Button>
            </div>
          )}
        </AssistantPanel>
      )}
    </li>
  );
}

/** Cadre, adresse affichée, taille et position de l'image d'une slide. */
function SlideImageControls({
  image,
  onChange,
  onReplace,
}: {
  image: SlideImage;
  onChange: (image: SlideImage | null) => void;
  onReplace: () => void;
}) {
  const set = <K extends keyof SlideImage>(key: K, value: SlideImage[K]) => onChange({ ...image, [key]: value });
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-2.5">
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- médias locaux servis par l'API */}
        <img
          src={libraryImageUrl(image.assetId)}
          alt=""
          className="size-10 shrink-0 rounded border bg-muted object-cover object-top"
        />
        <span className="text-xs font-medium">Image de la slide</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Cadre</span>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {IMAGE_FRAMES.map((frame) => (
            <Button
              key={frame.id}
              type="button"
              size="sm"
              variant={image.frame === frame.id ? "secondary" : "ghost"}
              aria-pressed={image.frame === frame.id}
              className={cn("h-7 text-xs", image.frame === frame.id && "ring-1 ring-primary/40")}
              onClick={() => onChange({ ...image, frame: frame.id, ...FRAME_DEFAULTS[frame.id] })}
            >
              {frame.label}
            </Button>
          ))}
        </div>
      </div>
      {(image.frame === "browser" || image.frame === "phone") && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Adresse affichée dans la barre</span>
          <Input
            value={image.url}
            onChange={(e) => set("url", e.target.value.slice(0, 200))}
            placeholder="tamarque.fr (vide : pas d'adresse)"
            className="h-8"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Libellé au-dessus (d&apos;où vient la capture)</span>
        <Input
          value={image.label}
          onChange={(e) => set("label", e.target.value.slice(0, 120))}
          placeholder="Ex. : La taille, sur ollama.com (vide : pas de libellé)"
          className="h-8"
        />
      </label>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <RangeField label="Taille" value={image.width} min={15} max={100} onChange={(v) => set("width", v)} />
        <RangeField label="Hauteur (haut du cadre)" value={image.y} min={-20} max={95} onChange={(v) => set("y", v)} />
        <RangeField label="Position horizontale" value={image.x} min={0} max={100} onChange={(v) => set("x", v)} />
        <RangeField label="Rotation" value={image.rotation} min={-15} max={15} unit="°" onChange={(v) => set("rotation", v)} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReplace}>
          <Replace /> Changer d&apos;image
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
          <Trash2 /> Retirer
        </Button>
      </div>
    </div>
  );
}
