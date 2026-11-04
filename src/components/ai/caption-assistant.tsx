"use client";

import { Check, ChevronDown, Hash, RefreshCw, Wand2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import type { Draft } from "@/components/posts/post-editor";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { activeModel } from "@/lib/ai/settings";
import { researchForPrompt } from "@/lib/ai/research";
import { REWRITE_MODES, type PostContext, type RewriteMode } from "@/lib/ai/tasks";
import { normalizeHashtags } from "@/lib/captions";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

import { AiError, AiIcon, AiProgress } from "./ai-progress";
import { useAiTask } from "./use-ai-task";

/** Informations du post envoyées à l'assistant. */
export function usePostContext(draft: Draft): PostContext {
  const { meta } = useApp();
  return {
    title: draft.title,
    notes: draft.notes,
    format: draft.format,
    pillar: meta.pillars.find((p) => p.id === draft.pillarId)?.name ?? null,
    campaign: meta.campaigns.find((c) => c.id === draft.campaignId)?.name ?? null,
    platforms: draft.platforms.map((p) => p.platform),
    cta: draft.cta,
    link: draft.link,
    caption: draft.caption,
    hashtags: draft.hashtags,
    aiMode: draft.aiMode,
    research: researchForPrompt(draft.research),
  };
}

/** Vérifie qu'un modèle est configuré avant de lancer une génération. */
export function useAiReady() {
  const { meta } = useApp();
  return () => {
    if (activeModel(meta.ai)) return true;
    toast.error("Configure d'abord l'assistant IA dans Réglages (modèle LM Studio ou OpenRouter).");
    return false;
  };
}

export function Proposal({
  text,
  actionLabel,
  onUse,
  limit,
}: {
  text: string;
  actionLabel: string;
  onUse: () => void;
  /** Limite de caractères à signaler si elle est dépassée. */
  limit?: number;
}) {
  const length = [...text].length;
  const tooLong = limit !== undefined && length > limit;
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <p className="text-sm whitespace-pre-wrap">{text}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs text-muted-foreground", tooLong && "font-medium text-destructive")}>
          {limit !== undefined ? `${length} / ${limit} caractères` : `${length} caractères`}
          {tooLong && " · trop long"}
        </span>
        <Button size="sm" variant="secondary" onClick={onUse}>
          <Check /> {actionLabel}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Légende : propositions et réécriture                               */
/* ------------------------------------------------------------------ */

export function CaptionAssistant({
  draft,
  onApply,
}: {
  draft: Draft;
  onApply: (caption: string) => void;
}) {
  const post = usePostContext(draft);
  const ready = useAiReady();
  const captions = useAiTask("captions");
  const rewrite = useAiTask("rewrite");
  const [active, setActive] = useState<"captions" | "rewrite" | "custom" | null>(null);
  const [mode, setMode] = useState<RewriteMode>("shorter");
  const [instruction, setInstruction] = useState("");
  const hasCaption = draft.caption.trim().length > 0;

  function close() {
    captions.cancel();
    rewrite.cancel();
    setActive(null);
    setInstruction("");
  }

  function propose() {
    if (!ready()) return;
    rewrite.cancel();
    setActive("captions");
    void captions.run({ post, instruction });
  }

  function runRewrite(nextMode: RewriteMode) {
    if (!ready()) return;
    captions.cancel();
    setMode(nextMode);
    setActive("rewrite");
    void rewrite.run({ post, caption: draft.caption, mode: nextMode, instruction });
  }

  function openCustom() {
    if (!ready()) return;
    captions.cancel();
    rewrite.cancel();
    setInstruction("");
    setActive("custom");
  }

  function apply(text: string) {
    onApply(text);
    toast.success("Légende mise à jour");
    close();
  }

  const modeLabel = REWRITE_MODES.find((m) => m.id === mode)?.label;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={propose}>
          <AiIcon /> Proposer des légendes
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!hasCaption}>
              <Wand2 className="text-primary" /> Retravailler <ChevronDown className="opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {REWRITE_MODES.map((m, index) => (
              <div key={m.id}>
                {index === REWRITE_MODES.length - 1 && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onSelect={() => (m.id === "custom" ? openCustom() : runRewrite(m.id))}
                >
                  {m.label}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {active === "custom" && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <span className="text-xs font-medium">Comment réécrire la légende ?</span>
          <div className="flex gap-2">
            <Input
              autoFocus
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && instruction.trim()) {
                  e.preventDefault();
                  runRewrite("custom");
                }
              }}
              placeholder="Ex. : parle davantage du gain de temps, termine par une question"
              className="h-8"
            />
            <Button size="sm" onClick={() => runRewrite("custom")} disabled={!instruction.trim()}>
              Lancer
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={close} aria-label="Fermer">
              <X />
            </Button>
          </div>
        </div>
      )}

      {active === "captions" && (
        <AssistantPanel title="Propositions de légendes" onClose={close}>
          {captions.state.status === "running" && (
            <AiProgress
              phase={captions.state.phase}
              startedAt={captions.state.startedAt}
              onCancel={close}
            />
          )}
          {captions.state.status === "error" && (
            <AiError message={captions.state.error} onRetry={propose} />
          )}
          {captions.state.status === "done" && (
            <>
              {captions.state.result.captions.map((text, i) => (
                <Proposal key={i} text={text} actionLabel="Utiliser" onUse={() => apply(text)} />
              ))}
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
                  placeholder="Affiner (optionnel) : plus court, parler de…, ton plus pro…"
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={propose}>
                  <RefreshCw /> Relancer
                </Button>
              </div>
            </>
          )}
        </AssistantPanel>
      )}

      {active === "rewrite" && (
        <AssistantPanel title={`Retravailler : ${modeLabel}`} onClose={close}>
          {rewrite.state.status === "running" && (
            <AiProgress
              phase={rewrite.state.phase}
              startedAt={rewrite.state.startedAt}
              onCancel={close}
            />
          )}
          {rewrite.state.status === "error" && (
            <AiError message={rewrite.state.error} onRetry={() => runRewrite(mode)} />
          )}
          {rewrite.state.status === "done" && (
            <>
              <Proposal
                text={rewrite.state.result.caption}
                actionLabel="Remplacer la légende"
                onUse={() => apply(rewrite.state.status === "done" ? rewrite.state.result.caption : "")}
              />
              <Button size="sm" variant="ghost" className="self-start" onClick={() => runRewrite(mode)}>
                <RefreshCw /> Autre proposition
              </Button>
            </>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}

export function AssistantPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2">
        <AiIcon className="size-4" />
        <span className="text-xs font-semibold">{title}</span>
        <Button size="icon-sm" variant="ghost" className="ml-auto" onClick={onClose} aria-label="Fermer">
          <X />
        </Button>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hashtags                                                           */
/* ------------------------------------------------------------------ */

export function HashtagAssistant({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (hashtags: string) => void;
}) {
  const { meta } = useApp();
  const post = usePostContext(draft);
  const ready = useAiReady();
  const task = useAiTask("hashtags");
  const [open, setOpen] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  function suggest() {
    if (!ready()) return;
    setExcluded(new Set());
    setOpen(true);
    void task.run({ post, count: 15 });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  const suggestions = task.state.status === "done" ? task.state.result.hashtags : [];
  const selected = suggestions.filter((tag) => !excluded.has(tag));
  const total = normalizeHashtags(`${draft.hashtags} ${selected.join(" ")}`)
    .split(" ")
    .filter(Boolean).length;
  // Réseau choisi le plus strict sur le nombre de hashtags.
  const strictest = draft.platforms
    .map((p) => PLATFORMS[p.platform])
    .filter((config) => config.hashtagLimit !== null)
    .sort((a, b) => a.hashtagLimit! - b.hashtagLimit!)[0];
  const limit = strictest?.hashtagLimit ?? null;

  function add() {
    onChange(normalizeHashtags(`${draft.hashtags} ${selected.join(" ")}`));
    toast.success(`${selected.length} hashtag(s) ajouté(s)`);
    close();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={suggest}>
          <AiIcon /> Suggérer des hashtags
        </Button>
        {meta.hashtagGroups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Hash className="text-primary" /> Groupes <ChevronDown className="opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {meta.hashtagGroups.map((group) => (
                <DropdownMenuItem
                  key={group.id}
                  disabled={!group.hashtags}
                  onSelect={() => {
                    onChange(normalizeHashtags(`${draft.hashtags} ${group.hashtags}`));
                    toast.success(`Groupe « ${group.name} » ajouté`);
                  }}
                >
                  <span className="font-medium">{group.name}</span>
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">
                    {group.hashtags.split(" ").filter(Boolean).length}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open && (
        <AssistantPanel title="Hashtags suggérés" onClose={close}>
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={suggest} />}
          {task.state.status === "done" && (
            <>
              <HashtagChips
                tags={suggestions}
                excluded={excluded}
                onToggle={(tag) => setExcluded((prev) => toggled(prev, tag))}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={add} disabled={selected.length === 0}>
                  <Check /> Ajouter la sélection ({selected.length})
                </Button>
                <Button size="sm" variant="ghost" onClick={suggest}>
                  <RefreshCw /> Autres suggestions
                </Button>
                {limit !== null && total > limit && (
                  <span className="text-xs font-medium text-destructive">
                    {total} hashtags au total : {strictest?.label} en accepte {limit} maximum.
                  </span>
                )}
              </div>
            </>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}

/** Copie de l'ensemble avec la valeur ajoutée ou retirée. */
export function toggled<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Hashtags proposés : un clic retire (ou remet) un hashtag dans la sélection. */
export function HashtagChips({
  tags,
  excluded,
  onToggle,
}: {
  tags: string[];
  excluded: Set<string>;
  onToggle: (tag: string) => void;
}) {
  return (
    <>
      <p className="text-xs text-muted-foreground">Clique sur un hashtag pour le retirer de la sélection.</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const on = !excluded.has(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                on
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "bg-card text-muted-foreground line-through",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Adaptation par réseau                                              */
/* ------------------------------------------------------------------ */

export function useAdaptCaption(draft: Draft, platform: PlatformId) {
  const post = usePostContext(draft);
  const ready = useAiReady();
  const task = useAiTask("adapt");

  function adapt() {
    if (!draft.caption.trim()) {
      toast.error("Écris d'abord la légende commune : l'assistant l'adaptera.");
      return;
    }
    if (!ready()) return;
    void task.run({ post, caption: draft.caption, platform });
  }

  return { state: task.state, adapt, close: task.cancel };
}

export function AdaptPanel({
  platform,
  state,
  onRetry,
  onClose,
  onUse,
}: {
  platform: PlatformId;
  state: ReturnType<typeof useAdaptCaption>["state"];
  onRetry: () => void;
  onClose: () => void;
  onUse: (caption: string, hashtags: string[]) => void;
}) {
  if (state.status === "idle") return null;
  return (
    <AssistantPanel title={`Adaptation pour ${PLATFORMS[platform].label}`} onClose={onClose}>
      {state.status === "running" && (
        <AiProgress phase={state.phase} startedAt={state.startedAt} onCancel={onClose} />
      )}
      {state.status === "error" && <AiError message={state.error} onRetry={onRetry} />}
      {state.status === "done" && (
        <>
          <Proposal
            text={[state.result.caption, state.result.hashtags.join(" ")].filter(Boolean).join("\n\n")}
            limit={PLATFORMS[platform].captionLimit}
            actionLabel={`Utiliser pour ${PLATFORMS[platform].label}`}
            onUse={() => {
              onUse(state.result.caption, state.result.hashtags);
              onClose();
            }}
          />
          <Button size="sm" variant="ghost" className="self-start" onClick={onRetry}>
            <RefreshCw /> Autre proposition
          </Button>
        </>
      )}
    </AssistantPanel>
  );
}
