"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock } from "lucide-react";

import { useApp } from "@/components/app-provider";
import { useNow } from "@/components/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { platformChoices } from "@/lib/accounts";
import { AI_MODES, type AiMode } from "@/lib/ai/tasks";
import { FORMATS, PRIORITIES, type PlatformId } from "@/lib/platforms";
import type { Draft } from "@/lib/post-draft";
import { dueState, scheduleLabel } from "@/lib/post-status";
import type { PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { ChecklistEditor } from "./checklist-section";
import { FormatIcon } from "./format-icon";
import { ColorDot } from "./platform-badge";
import { PlatformToggles } from "./platform-toggles";
import { SchedulePicker } from "./schedule-picker";

type Update = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const NONE = "none";
/** Liste déroulante discrète, alignée sur les autres propriétés. */
const ghostTrigger = "h-8 w-full border-transparent bg-transparent px-2 shadow-none hover:bg-accent dark:bg-transparent";

function Property({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 [&>label]:self-start [&>label]:pt-2.5">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DateProperty({ draft, update }: { draft: Draft; update: Update }) {
  const { meta } = useApp();
  const now = useNow();
  const kind = meta.columns.find((c) => c.id === draft.columnId)?.kind ?? "progress";
  const state = dueState(draft.scheduledAt, kind, now);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="scheduledAt"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-full justify-start px-2 font-normal",
            draft.scheduledAt === null && "text-muted-foreground",
            state === "overdue" && "text-destructive",
            state === "soon" && "text-warning",
          )}
        >
          <CalendarClock />
          {draft.scheduledAt === null ? "Choisir une date" : scheduleLabel(draft.scheduledAt, now)}
          {state === "overdue" && <span className="text-xs">· en retard</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <SchedulePicker value={draft.scheduledAt} onChange={(value) => update("scheduledAt", value)} />
      </PopoverContent>
    </Popover>
  );
}

/** Panneau « Détails » de la fiche d'un post : date, réseaux, classement, checklist. */
export function DetailsPanel({ draft, update, post }: { draft: Draft; update: Update; post?: PostDTO }) {
  const { meta } = useApp();

  const selectedPlatforms = draft.platforms.map((p) => p.platform);
  const setPlatforms = (platforms: PlatformId[]) =>
    update(
      "platforms",
      platforms.map(
        (id) => draft.platforms.find((p) => p.platform === id) ?? { platform: id, customCaption: null, customHashtags: null },
      ),
    );

  const done = draft.checklist.filter((c) => c.done).length;

  return (
    <div className="flex flex-col gap-6 p-4">
      <section className="flex flex-col gap-0.5" aria-label="Propriétés">
        <Property label="Publication" htmlFor="scheduledAt">
          <DateProperty draft={draft} update={update} />
        </Property>
        <Property label="Réseaux">
          <PlatformToggles
            value={selectedPlatforms}
            onChange={setPlatforms}
            choices={platformChoices(meta.accounts, selectedPlatforms)}
            className="px-1 py-1"
          />
        </Property>
        <Property label="Format" htmlFor="format">
          <Select value={draft.format} onValueChange={(v) => update("format", v)}>
            <SelectTrigger id="format" className={ghostTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <FormatIcon format={f.id} className="size-4" />
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Property>
        <Property label="Pilier" htmlFor="pillar">
          <Select
            value={draft.pillarId === null ? NONE : String(draft.pillarId)}
            onValueChange={(v) => update("pillarId", v === NONE ? null : Number(v))}
          >
            <SelectTrigger id="pillar" className={ghostTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aucun</SelectItem>
              <SelectSeparator />
              {meta.pillars.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <ColorDot color={p.color} />
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Property>
        <Property label="Campagne" htmlFor="campaign">
          <Select
            value={draft.campaignId === null ? NONE : String(draft.campaignId)}
            onValueChange={(v) => update("campaignId", v === NONE ? null : Number(v))}
          >
            <SelectTrigger id="campaign" className={ghostTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aucune</SelectItem>
              {meta.campaigns.length > 0 && <SelectSeparator />}
              {meta.campaigns.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  <ColorDot color={c.color} />
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Property>
        <Property label="Priorité" htmlFor="priority">
          <Select value={draft.priority} onValueChange={(v) => update("priority", v)}>
            <SelectTrigger id="priority" className={ghostTrigger}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <ColorDot color={p.color} />
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Property>
        <Property label="Rédaction IA" htmlFor="aiMode">
          <Select value={draft.aiMode} onValueChange={(v) => update("aiMode", v as AiMode)}>
            <SelectTrigger
              id="aiMode"
              className={ghostTrigger}
              title={AI_MODES.find((m) => m.id === draft.aiMode)?.hint}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id} title={m.hint}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Property>
      </section>

      <section className="flex flex-col gap-2" aria-label="Checklist">
        <h3 className="flex items-center justify-between text-sm font-semibold">
          Checklist
          {draft.checklist.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {done}/{draft.checklist.length}
            </span>
          )}
        </h3>
        <ChecklistEditor items={draft.checklist} onChange={(items) => update("checklist", items)} />
      </section>

      <section className="flex flex-col gap-1.5" aria-label="Publication">
        <Label htmlFor="publishedUrl" className="text-sm font-semibold">
          Lien du post publié
        </Label>
        <Input
          id="publishedUrl"
          type="url"
          value={draft.publishedUrl}
          onChange={(e) => update("publishedUrl", e.target.value)}
          placeholder="https://www.instagram.com/p/…"
          className="h-8"
        />
      </section>

      {post && (
        <p className="text-xs text-muted-foreground">
          Créé le {format(post.createdAt, "d MMM yyyy", { locale: fr })} · modifié le{" "}
          {format(post.updatedAt, "d MMM yyyy à HH:mm", { locale: fr })}
        </p>
      )}
    </div>
  );
}
