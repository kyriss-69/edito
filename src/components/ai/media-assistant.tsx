"use client";

import { Check, ChevronRight, Loader2, RefreshCw, Sparkles, Wand2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { FormatIcon } from "@/components/posts/format-icon";
import { MediaThumb } from "@/components/posts/post-card";
import { PlatformToggles } from "@/components/posts/platform-toggles";
import type { Draft } from "@/components/posts/post-editor";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { platformChoices } from "@/lib/accounts";
import { MAX_ANALYSIS_IMAGES, mediaKind, planFrames } from "@/lib/ai/media";
import type { AiTaskOutput } from "@/lib/ai/tasks";
import { normalizeHashtags } from "@/lib/captions";
import { FORMATS, PLATFORMS, type PlatformId } from "@/lib/platforms";
import type { MediaDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AiError, AiIcon, AiProgress } from "./ai-progress";
import { AssistantPanel, HashtagChips, toggled, useAiReady, usePostContext } from "./caption-assistant";
import { collectAnalysisImages } from "./media-frames";
import { useAiTask } from "./use-ai-task";

type Update = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

type Field = "title" | "caption" | "hashtags" | "cta" | "notes";
type Picks = Record<Field, boolean>;

const NO_PICKS: Picks = { title: false, caption: false, hashtags: false, cta: false, notes: false };

/** Titre encore vide (« Sans titre » est mis automatiquement à l'ajout du premier média). */
function hasTitle(draft: Draft) {
  const title = draft.title.trim();
  return Boolean(title) && title !== "Sans titre";
}

/** Coche par défaut les champs encore vides, pour ne rien écraser sans le vouloir. */
function defaultPicks(draft: Draft): Picks {
  return {
    title: !hasTitle(draft),
    caption: !draft.caption.trim(),
    hashtags: true,
    cta: !draft.cta.trim(),
    notes: false,
  };
}

/** Étape du remplissage automatique (création rapide). */
type QuickRun =
  | { status: "idle" }
  | { status: "running"; label: string }
  | { status: "done"; filled: string[]; adapted: PlatformId[]; failed: PlatformId[] };

/** Formats proposés dans la création rapide (Live n'a pas de média à analyser). */
const QUICK_FORMATS = FORMATS.filter((f) => f.id !== "live");

/**
 * Analyse des photos et vidéos du post par un modèle « vision ». Création rapide :
 * on choisit réseaux et format, l'IA remplit titre, légende, hashtags et appel à
 * l'action, puis adapte la légende à chaque réseau (avec les skills par réseau).
 * Le panneau détaillé permet ensuite de choisir parmi les autres propositions.
 */
export function MediaAssistant({
  media,
  draft,
  update,
}: {
  media: MediaDTO[];
  draft: Draft;
  update: Update;
}) {
  const { meta } = useApp();
  const post = usePostContext(draft);
  const ready = useAiReady();
  const task = useAiTask("mediaAnalysis");
  const adaptTask = useAiTask("adapt");
  const [quick, setQuick] = useState<QuickRun>({ status: "idle" });
  const [adaptEach, setAdaptEach] = useState(true);
  const [open, setOpen] = useState(false);
  const [unselected, setUnselected] = useState<Set<number>>(new Set());
  const [preparing, setPreparing] = useState(false);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("");
  const [excludedTags, setExcludedTags] = useState<Set<string>>(new Set());
  const [picks, setPicks] = useState<Picks>(NO_PICKS);
  const [captionIndex, setCaptionIndex] = useState(0);
  const runRef = useRef(0);

  // Abandonne une préparation en cours si la fiche se ferme.
  useEffect(() => {
    const runs = runRef;
    return () => {
      runs.current++;
    };
  }, []);

  const chosen = media.filter((m) => !unselected.has(m.id));
  const counts = planFrames(chosen.map((m) => mediaKind(m.mimeType)));
  const notAnalyzed = counts.filter((c) => c === 0).length;
  const withVideo = chosen.some((m) => mediaKind(m.mimeType) === "video");

  if (media.length === 0) return null;

  async function analyze({ panel = true }: { panel?: boolean } = {}): Promise<AiTaskOutput<"mediaAnalysis"> | null> {
    if (!ready()) return null;
    if (!chosen.length) {
      toast.error("Sélectionne au moins un média à analyser.");
      return null;
    }
    const run = ++runRef.current;
    if (panel) setOpen(true);
    task.reset();
    setPrepError(null);
    setSkipped([]);
    setPreparing(true);
    const prepared = await collectAnalysisImages(chosen, media).catch(() => null);
    if (run !== runRef.current) return null;
    setPreparing(false);
    setSkipped(prepared?.skipped ?? []);
    if (!prepared?.images.length) {
      setPrepError(
        "Impossible de lire ces médias dans le navigateur (format non pris en charge, par exemple HEIC). Exporte-les en JPEG, PNG ou MP4, puis réessaie.",
      );
      return null;
    }
    setExcludedTags(new Set());
    setCaptionIndex(0);
    const output = await task.run({
      post,
      images: prepared.images,
      hasVideo: prepared.hasVideo,
      count: 15,
      instruction,
    });
    if (!output || run !== runRef.current) return null;
    setPicks(defaultPicks(draft));
    return output;
  }

  const platforms = draft.platforms.map((p) => p.platform);
  const setPlatforms = (ids: PlatformId[]) =>
    update(
      "platforms",
      ids.map((id) => draft.platforms.find((p) => p.platform === id) ?? { platform: id, customCaption: null, customHashtags: null }),
    );

  /**
   * Création rapide : analyse, remplit les champs encore vides (la légende est
   * remplacée si elle est vide), puis adapte la légende à chaque réseau.
   */
  async function quickFill() {
    if (!platforms.length) {
      toast.error("Choisis au moins un réseau.");
      return;
    }
    const run = runRef.current + 1;
    setQuick({ status: "running", label: "Analyse des médias…" });
    const output = await analyze({ panel: false });
    if (!output || run !== runRef.current) {
      setQuick({ status: "idle" });
      if (output === null && run === runRef.current) setOpen(true); // montre l'erreur
      return;
    }
    const caption = output.captions[0] ?? "";
    const filled: string[] = [];
    if (!hasTitle(draft) && output.title) {
      update("title", output.title);
      filled.push("titre");
    }
    if (!draft.caption.trim() && caption) {
      update("caption", caption);
      filled.push("légende");
    }
    if (output.hashtags.length) {
      update("hashtags", normalizeHashtags(`${draft.hashtags} ${output.hashtags.join(" ")}`));
      filled.push("hashtags");
    }
    if (!draft.cta.trim() && output.cta) {
      update("cta", output.cta);
      filled.push("appel à l'action");
    }

    const base = draft.caption.trim() || caption;
    const entries = draft.platforms.map((p) => ({ ...p }));
    const adapted: PlatformId[] = [];
    const failed: PlatformId[] = [];
    if (adaptEach && base) {
      const context = { ...post, caption: base, hashtags: normalizeHashtags(`${draft.hashtags} ${output.hashtags.join(" ")}`) };
      for (const entry of entries) {
        if (run !== runRef.current) return;
        if (entry.customCaption !== null) continue; // déjà personnalisée : on n'y touche pas
        setQuick({ status: "running", label: `Adaptation pour ${PLATFORMS[entry.platform].label}…` });
        const result = await adaptTask.run({ post: context, caption: base, platform: entry.platform });
        if (run !== runRef.current) return;
        if (!result) {
          failed.push(entry.platform);
          continue;
        }
        entry.customCaption = result.caption;
        if (result.hashtags.length) entry.customHashtags = normalizeHashtags(result.hashtags.join(" "));
        adapted.push(entry.platform);
        update("platforms", entries.map((e) => ({ ...e })));
      }
    }
    setQuick({ status: "done", filled, adapted, failed });
    toast.success("Post rédigé : relis-le avant de le planifier.");
    setTimeout(() => {
      document.getElementById("caption")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  function cancelQuick() {
    runRef.current++;
    task.cancel();
    adaptTask.cancel();
    setPreparing(false);
    setQuick({ status: "idle" });
  }

  /** Ouvre le panneau : directement l'analyse s'il n'y a qu'un média, sinon le choix des médias. */
  function start() {
    if (media.length === 1) {
      void analyze();
      return;
    }
    if (!ready()) return;
    setOpen(true);
  }

  function close() {
    runRef.current++;
    setPreparing(false);
    setPrepError(null);
    task.cancel();
    setOpen(false);
  }

  const result = task.state.status === "done" ? task.state.result : null;
  const selectedTags = result ? result.hashtags.filter((tag) => !excludedTags.has(tag)) : [];
  const caption = result?.captions[Math.min(captionIndex, result.captions.length - 1)] ?? "";
  const busy = preparing || task.state.status === "running";

  const available: Picks = {
    title: Boolean(result?.title),
    caption: Boolean(caption),
    hashtags: selectedTags.length > 0,
    cta: Boolean(result?.cta),
    notes: Boolean(result?.description),
  };
  const toApply = (Object.keys(picks) as Field[]).filter((f) => picks[f] && available[f]);

  function apply() {
    if (!result) return;
    const done: string[] = [];
    if (toApply.includes("title")) {
      update("title", result.title);
      done.push("titre");
    }
    if (toApply.includes("caption")) {
      update("caption", caption);
      done.push("légende");
    }
    if (toApply.includes("hashtags")) {
      update("hashtags", normalizeHashtags(`${draft.hashtags} ${selectedTags.join(" ")}`));
      done.push(`${selectedTags.length} hashtag(s)`);
    }
    if (toApply.includes("cta")) {
      update("cta", result.cta);
      done.push("appel à l'action");
    }
    if (toApply.includes("notes")) {
      const text = `ANALYSE DES MÉDIAS\n${result.description}`;
      update("notes", draft.notes.trim() ? `${draft.notes.trim()}\n\n${text}` : text);
      done.push("notes");
    }
    toast.success(`Post rempli : ${done.join(", ")}. Pense à enregistrer.`);
    close();
    // Après la fermeture du panneau, qui décale la page.
    setTimeout(() => {
      document.getElementById("caption")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  const pick = (field: Field) => ({
    checked: picks[field],
    onChange: (checked: boolean) => setPicks((prev) => ({ ...prev, [field]: checked })),
  });

  return (
    <div className="flex flex-col gap-2">
      {!open && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
              <Sparkles className="size-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Rédiger le post avec l&apos;IA</p>
              <p className="text-xs text-muted-foreground">
                Choisis où et comment le publier : l&apos;IA regarde {media.length > 1 ? "tes médias" : "ton média"}{" "}
                et écrit titre, légende, hashtags et appel à l&apos;action, adaptés à chaque réseau.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Réseaux</span>
            <PlatformToggles
              value={platforms}
              onChange={setPlatforms}
              choices={platformChoices(meta.accounts, platforms)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Format</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Format">
              {QUICK_FORMATS.map((f) => {
                const selected = draft.format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update("format", f.id)}
                    className={cn(
                      "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                      selected
                        ? "border-primary/40 bg-primary/10 text-foreground"
                        : "bg-card text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <FormatIcon format={f.id} className="size-3.5" />
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && quick.status !== "running") {
                e.preventDefault();
                void quickFill();
              }
            }}
            placeholder="Précision (optionnel) : le sujet, le ton, une info à placer…"
            className="h-8 bg-card"
            disabled={quick.status === "running"}
          />

          {platforms.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={adaptEach}
                onCheckedChange={(v) => setAdaptEach(v === true)}
                disabled={quick.status === "running"}
              />
              Adapter la légende à chaque réseau (un peu plus long)
            </label>
          )}

          {quick.status === "running" ? (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-primary/20 bg-card px-3 py-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="font-medium">{preparing ? "Préparation des images…" : quick.label}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={cancelQuick}>
                <X /> Annuler
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void quickFill()} disabled={!platforms.length}>
                <Wand2 /> {quick.status === "done" ? "Rédiger à nouveau" : "Rédiger le post"}
              </Button>
              {quick.status === "done" && result && (
                <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
                  Voir les autres propositions <ChevronRight />
                </Button>
              )}
              {quick.status === "idle" && (
                <Button variant="ghost" size="sm" onClick={start}>
                  Choisir moi-même <ChevronRight />
                </Button>
              )}
            </div>
          )}

          {quick.status === "done" && (
            <p className="text-xs text-muted-foreground">
              {quick.filled.length ? `Rempli : ${quick.filled.join(", ")}.` : "Les champs déjà remplis n'ont pas été modifiés."}
              {quick.adapted.length > 0 &&
                ` Légende adaptée pour ${quick.adapted.map((p) => PLATFORMS[p].label).join(", ")}.`}
              {quick.failed.length > 0 && (
                <span className="text-destructive">
                  {" "}
                  Adaptation impossible pour {quick.failed.map((p) => PLATFORMS[p].label).join(", ")} : relance-la depuis sa
                  carte de légende.
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {open && (
        <AssistantPanel title="Remplir le post avec l'IA" onClose={close}>
          {media.length > 1 && !result && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                Médias à analyser ({chosen.length} / {media.length}) — clique pour (dé)sélectionner.
              </span>
              <div className="flex flex-wrap gap-1.5">
                {media.map((m, index) => {
                  const on = !unselected.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      title={m.originalName}
                      aria-label={`Média ${index + 1} : ${m.originalName}`}
                      disabled={busy}
                      onClick={() => setUnselected((prev) => toggled(prev, m.id))}
                      className={cn(
                        "relative size-14 overflow-hidden rounded-md border-2 bg-muted transition",
                        on ? "border-primary" : "border-transparent opacity-40 grayscale",
                      )}
                    >
                      <MediaThumb media={m} className="size-full" />
                      {on && (
                        <span className="absolute top-0.5 right-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Check className="size-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {notAnalyzed > 0 && (
                <p className="text-xs text-muted-foreground">
                  {MAX_ANALYSIS_IMAGES} images maximum : seuls les {chosen.length - notAnalyzed} premiers
                  médias sélectionnés seront analysés.
                </p>
              )}
            </div>
          )}
          {withVideo && !result && (
            <p className="text-xs text-muted-foreground">
              Vidéos : l&apos;assistant voit quelques images extraites, mais n&apos;entend pas le son.
            </p>
          )}

          {preparing && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm"
            >
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="font-medium">Préparation des images…</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={close}>
                <X /> Annuler
              </Button>
            </div>
          )}
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {prepError && <AiError message={prepError} />}
          {task.state.status === "error" && <AiError message={task.state.error} />}
          {skipped.length > 0 && (
            <p className="text-xs text-destructive">
              Non lus par le navigateur (format non pris en charge) : {skipped.join(", ")}
            </p>
          )}

          {result && (
            <>
              {result.description && (
                <p className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Ce que voit l&apos;assistant : </span>
                  {result.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Coche ce que tu veux mettre dans le post. Les champs déjà remplis sont décochés pour ne
                rien écraser.
              </p>

              {result.title && (
                <PickRow label="Titre" replaces={hasTitle(draft)} {...pick("title")}>
                  <p className="text-sm font-medium">{result.title}</p>
                </PickRow>
              )}

              <PickRow label="Légende" replaces={Boolean(draft.caption.trim())} {...pick("caption")}>
                {result.captions.length > 1 && (
                  <div className="flex gap-1" role="tablist" aria-label="Propositions de légende">
                    {result.captions.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={i === captionIndex}
                        onClick={() => setCaptionIndex(i)}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs transition-colors",
                          i === captionIndex
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-card text-muted-foreground hover:bg-accent",
                        )}
                      >
                        Proposition {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">{caption}</p>
                <span className="text-xs text-muted-foreground">{[...caption].length} caractères</span>
              </PickRow>

              {result.hashtags.length > 0 && (
                <PickRow label="Hashtags" hint="ajoutés aux tiens" {...pick("hashtags")}>
                  <HashtagChips
                    tags={result.hashtags}
                    excluded={excludedTags}
                    onToggle={(tag) => setExcludedTags((prev) => toggled(prev, tag))}
                  />
                </PickRow>
              )}

              {result.cta && (
                <PickRow label="Appel à l'action" replaces={Boolean(draft.cta.trim())} {...pick("cta")}>
                  <p className="text-sm">{result.cta}</p>
                </PickRow>
              )}

              {result.description && (
                <PickRow label="Description dans les notes" hint="ajoutée à la fin" {...pick("notes")} />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={apply} disabled={toApply.length === 0}>
                  <Check /> Remplir le post ({toApply.length})
                </Button>
                <span className="text-xs text-muted-foreground">Les champs cochés remplacent ceux de la fiche.</span>
              </div>
            </>
          )}

          {!busy && (
            <div className="flex gap-2">
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void analyze();
                  }
                }}
                placeholder="Précision (optionnel) : c'est l'équipe en séminaire, ton plus fun…"
                className="h-8"
              />
              <Button size="sm" variant={result ? "outline" : "default"} onClick={() => void analyze()}>
                {result || task.state.status === "error" || prepError ? (
                  <>
                    <RefreshCw /> Relancer
                  </>
                ) : (
                  <>
                    <AiIcon className="text-current" /> Analyser
                  </>
                )}
              </Button>
            </div>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}

/** Une proposition de l'assistant, à cocher pour l'appliquer au post. */
function PickRow({
  label,
  hint,
  replaces = false,
  checked,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  /** Le champ du post est déjà rempli : l'appliquer le remplace. */
  replaces?: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-card p-3 transition-opacity",
        !checked && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
        <label htmlFor={id} className="text-xs font-semibold uppercase">
          {label}
        </label>
        {(hint || replaces) && (
          <span className="text-xs text-muted-foreground">· {hint ?? "remplace l'actuel"}</span>
        )}
      </div>
      {children}
    </div>
  );
}
