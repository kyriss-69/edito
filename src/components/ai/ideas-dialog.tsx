"use client";

import { Check, Plus, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ColorDot } from "@/components/posts/platform-badge";
import { PlatformToggles } from "@/components/posts/platform-toggles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultPostPlatforms, usedPlatforms } from "@/lib/accounts";
import { formatLabel, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { createPostsFromIdeas } from "@/server/actions";

import { AiError, AiIcon, AiProgress } from "./ai-progress";
import { useAiReady } from "./caption-assistant";
import { useAiTask } from "./use-ai-task";

const NONE = "none";
const COUNTS = [3, 5, 8, 10];

/** Ouvre la fenêtre des idées si l'assistant IA est configuré. */
export function useOpenIdeas() {
  const { openIdeas } = useApp();
  const ready = useAiReady();
  return () => {
    if (ready()) openIdeas();
  };
}

/** Bouton qui ouvre la génération d'idées de posts. */
export function IdeasButton({ className }: { className?: string }) {
  const openIdeas = useOpenIdeas();
  return (
    <Button variant="outline" size="sm" onClick={openIdeas} className={className}>
      <AiIcon /> <span className="max-sm:hidden">Idées</span>
    </Button>
  );
}

export function IdeasDialog({ onClose }: { onClose: () => void }) {
  const { meta, posts } = useApp();
  const task = useAiTask("ideas");
  const [pillarId, setPillarId] = useState<string>(NONE);
  const [platforms, setPlatforms] = useState<PlatformId[]>(() => {
    const defaults = defaultPostPlatforms(meta.accounts);
    return defaults.length ? defaults : usedPlatforms(meta.accounts);
  });
  const [count, setCount] = useState(5);
  const [instruction, setInstruction] = useState("");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();

  const pillar = meta.pillars.find((p) => String(p.id) === pillarId) ?? null;
  const ideas = task.state.status === "done" ? task.state.result.ideas : [];
  const selected = ideas.filter((_, i) => !excluded.has(i));
  const firstColumn = meta.columns[0];

  function generate() {
    setExcluded(new Set());
    const existingTitles = [...posts]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 60)
      .map((p) => p.title);
    void task.run({
      pillar: pillar?.name ?? null,
      platforms,
      count,
      instruction,
      existingTitles,
    });
  }

  function addToBoard() {
    startTransition(async () => {
      const result = await createPostsFromIdeas({
        ideas: selected,
        pillarId: pillar?.id ?? null,
        platforms,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.data.count} idée(s) ajoutée(s) dans « ${firstColumn?.name ?? "la première colonne"} »`,
      );
      onClose();
    });
  }

  const running = task.state.status === "running";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AiIcon className="size-5" /> Idées de posts
          </DialogTitle>
          <DialogDescription>
            L&apos;assistant propose des idées que tu peux ajouter directement au tableau.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ideas-pillar" className="text-xs text-muted-foreground">
              Pilier de contenu
            </Label>
            <Select value={pillarId} onValueChange={setPillarId}>
              <SelectTrigger id="ideas-pillar" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Tous les sujets</SelectItem>
                <SelectSeparator />
                {meta.pillars.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <ColorDot color={p.color} />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Réseaux</span>
            <PlatformToggles value={platforms} onChange={setPlatforms} choices={usedPlatforms(meta.accounts)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ideas-count" className="text-xs text-muted-foreground">
              Nombre d&apos;idées
            </Label>
            <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
              <SelectTrigger id="ideas-count" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} idées
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <Label htmlFor="ideas-instruction" className="text-xs text-muted-foreground">
              Consigne (optionnel)
            </Label>
            <Textarea
              id="ideas-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Ex. : lancement de la fonctionnalité X la semaine prochaine, posts pour la rentrée…"
              className="min-h-14"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {running && task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={task.cancel} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={generate} />}
          {ideas.map((idea, index) => {
            const on = !excluded.has(index);
            return (
              <label
                key={index}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                  on ? "border-primary/40 bg-primary/5" : "bg-card opacity-60",
                )}
              >
                <Checkbox
                  checked={on}
                  onCheckedChange={(checked) =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{idea.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {formatLabel(idea.format)}
                    </Badge>
                  </div>
                  {idea.hook && <p className="text-sm">« {idea.hook} »</p>}
                  {idea.angle && <p className="text-xs text-muted-foreground">{idea.angle}</p>}
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="items-center">
          {ideas.length > 0 && (
            <span className="mr-auto text-xs text-muted-foreground">
              {selected.length} / {ideas.length} sélectionnée(s)
            </span>
          )}
          {ideas.length === 0 ? (
            <Button onClick={generate} disabled={running || platforms.length === 0}>
              <AiIcon className="text-primary-foreground" /> Générer
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={generate} disabled={running}>
                <RefreshCw /> Régénérer
              </Button>
              <Button onClick={addToBoard} disabled={selected.length === 0 || pending}>
                {pending ? <Check /> : <Plus />}
                Ajouter {selected.length} idée(s) au tableau
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
