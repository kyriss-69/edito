"use client";

import { Check, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AiError, AiIcon, AiProgress } from "@/components/ai/ai-progress";
import { AssistantPanel, useAiReady } from "@/components/ai/caption-assistant";
import { useAiTask } from "@/components/ai/use-ai-task";
import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usedPlatforms } from "@/lib/accounts";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { isSlideEmpty, type Slide, withSlideTexts } from "@/lib/carousel";

import { libraryImageUrl, loadMockup } from "./render-slide";
import type { CarouselAiContext } from "./slide-editor";
import { captureUrl, slideImageFor } from "./slide-image-picker";

/** Rédaction de toutes les slides d'un coup, à partir de la description du post. */
export function CarouselAiWriter({
  context,
  onPlatformChange,
  onApply,
}: {
  context: CarouselAiContext;
  onPlatformChange: (platform: PlatformId | null) => void;
  onApply: (slides: Slide[]) => void;
}) {
  const { meta } = useApp();
  const ready = useAiReady();
  const [applying, setApplying] = useState(false);
  const task = useAiTask("carouselSlides");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const count = context.slides.length;
  const hasText = context.slides.some((slide) => !isSlideEmpty(slide));

  const platforms = usedPlatforms(meta.accounts);
  const platformName = context.platform ? PLATFORMS[context.platform].label : null;

  function generate(platform: PlatformId | null = context.platform) {
    onPlatformChange(platform);
    if (!context.description.trim()) {
      toast.error("Décris d'abord le post : l'IA s'en sert pour rédiger les slides.");
      return;
    }
    if (!ready()) return;
    setOpen(true);
    void task.run({ ...context, platform, instruction });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  const result = task.state.status === "done" ? task.state.result.slides : null;
  const proposal = result ? withSlideTexts(context.slides, result) : null;
  // Écran de l'app choisi par l'IA pour chaque slide (seulement s'il existe encore dans la médiathèque).
  const screenFor = (i: number) => {
    const id = result?.[i]?.screen;
    return id ? (meta.library.find((asset) => asset.id === id && context.screens?.some((s) => s.id === id)) ?? null) : null;
  };

  async function apply() {
    if (!proposal) return;
    setApplying(true);
    try {
      const slides = await Promise.all(
        proposal.map(async (slide, i) => {
          const asset = screenFor(i);
          if (!asset) return slide;
          try {
            const img = await loadMockup(libraryImageUrl(asset.id));
            const image = slideImageFor(asset.id, img.naturalWidth / img.naturalHeight, {
              url: captureUrl(asset),
              element: asset.notes.includes("un bloc de la page"),
            });
            return { ...slide, image };
          } catch {
            return slide;
          }
        }),
      );
      onApply(slides);
      toast.success("Slides mises à jour");
      close();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!open && (
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AiIcon /> {hasText ? "Réécrire tout le carrousel avec l'IA pour :" : "Rédiger tout le carrousel avec l'IA pour :"}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((platform) => (
              <Button
                key={platform}
                variant={context.platform === platform ? "secondary" : "outline"}
                size="sm"
                onClick={() => generate(platform)}
                title={`Écrire les slides selon les codes de ${PLATFORMS[platform].label}`}
              >
                <PlatformIcon platform={platform} className="size-3.5" /> {PLATFORMS[platform].label}
              </Button>
            ))}
            <Button
              variant={context.platform === null ? "secondary" : "outline"}
              size="sm"
              onClick={() => generate(null)}
              title="Un texte valable sur tous les réseaux"
            >
              Tous les réseaux
            </Button>
          </div>
        </div>
      )}
      {open && (
        <AssistantPanel
          title={`Proposition pour les ${count} slides${platformName ? ` · ${platformName}` : ""}`}
          onClose={close}
        >
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={() => generate()} />}
          {proposal && (
            <>
              <ol className="flex flex-col gap-1.5">
                {proposal.map((slide, i) => (
                  <li key={i} className="flex gap-2 rounded-md border bg-card p-2.5 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      {slide.title && <p className="font-semibold whitespace-pre-wrap">{slide.title}</p>}
                      {slide.body && <p className="whitespace-pre-wrap text-muted-foreground">{slide.body}</p>}
                      {isSlideEmpty(slide) && <p className="text-muted-foreground italic">(vide)</p>}
                      {screenFor(i) && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
                          <ImageIcon className="size-3.5" /> {screenFor(i)?.title}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => void apply()} disabled={applying}>
                  <Check /> {proposal.some((_, i) => screenFor(i)) ? "Utiliser ces textes et ces écrans" : "Utiliser ces textes"}
                </Button>
                {(hasText || proposal.some((_, i) => screenFor(i))) && (
                  <span className="text-xs text-muted-foreground">
                    Remplace le texte actuel{proposal.some((_, i) => screenFor(i)) ? " et l'image des slides illustrées" : " des slides"}.
                  </span>
                )}
              </div>
            </>
          )}
          {task.state.status !== "running" && (
            <div className="flex gap-2">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    generate();
                  }
                }}
                placeholder="Précision (optionnel) : ton plus fun, une astuce par slide…"
                className="h-8"
              />
              <Button size="sm" variant="outline" onClick={() => generate()}>
                <RefreshCw /> Relancer
              </Button>
            </div>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}
