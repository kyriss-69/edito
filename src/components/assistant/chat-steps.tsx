"use client";

import {
  AlertTriangle,
  Camera,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Images,
  Lightbulb,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { defaultPostPlatforms, usedPlatforms } from "@/lib/accounts";
import type { ChatIdea, ChatStep, ChatToolName } from "@/lib/ai/chat";
import { libraryImageUrl } from "@/lib/library";
import { formatLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { displayUrl } from "@/lib/web";
import { createPostsFromIdeas } from "@/server/actions";

const TOOL_ICONS: Record<ChatToolName, typeof Search> = {
  web_search: Search,
  read_page: FileText,
  take_screenshot: Camera,
  propose_post_ideas: Lightbulb,
};

/** Étapes d'une réponse : recherches, pages lues, captures et idées proposées. */
export function ChatSteps({ steps }: { steps: ChatStep[] }) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step) =>
        step.ideas && step.status === "done" ? (
          <IdeaCards key={step.id} ideas={step.ideas} />
        ) : (
          <StepRow key={step.id} step={step} />
        ),
      )}
    </div>
  );
}

function StepRow({ step }: { step: ChatStep }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[step.tool] ?? Search;
  const links = step.links ?? [];
  const expandable = step.tool === "web_search" && links.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={cn(
          "flex w-fit max-w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-left text-xs text-muted-foreground",
          expandable && "hover:text-foreground",
        )}
        aria-expanded={expandable ? open : undefined}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{step.label}</span>
        {step.status === "running" && <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />}
        {step.status === "done" && <Check className="size-3.5 shrink-0 text-success" />}
        {step.status === "error" && <AlertTriangle className="size-3.5 shrink-0 text-destructive" />}
        {step.detail && (
          <span className={cn("shrink-0", step.status === "error" && "text-destructive")}>· {step.detail}</span>
        )}
        {step.tool === "read_page" && links[0] && (
          <a
            href={links[0].url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 hover:text-foreground"
            aria-label="Ouvrir la page"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        {expandable && <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />}
      </button>
      {expandable && open && (
        <ul className="flex flex-col gap-1 border-l-2 pl-3">
          {links.map((link) => (
            <li key={link.url} className="text-xs">
              <a href={link.url} target="_blank" rel="noreferrer" className="hover:underline">
                <span className="font-medium">{link.title || displayUrl(link.url)}</span>{" "}
                <span className="text-muted-foreground">{displayUrl(link.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {step.capture && step.status === "done" && <CaptureCard capture={step.capture} />}
    </div>
  );
}

function CaptureCard({ capture }: { capture: NonNullable<ChatStep["capture"]> }) {
  const src = libraryImageUrl(capture.assetId);
  return (
    <figure className="flex w-full max-w-sm flex-col gap-2 rounded-lg border bg-card p-2">
      <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- médias locaux servis par l'API */}
        <img
          src={src}
          alt={capture.title}
          className={cn("w-full object-cover object-top", capture.device === "mobile" ? "max-h-80" : "max-h-56")}
        />
      </a>
      <figcaption className="flex flex-col gap-1.5 px-0.5">
        <span className="text-xs font-medium">{capture.title}</span>
        <span className="text-xs text-muted-foreground">
          Rangée dans la médiathèque (Captures). Dans le Studio, ajoute-la sur une slide avec le bouton « Image ».
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" asChild>
            <a href={`${src}&download=1`}>Télécharger</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/brand/media">
              <Images /> Médiathèque
            </Link>
          </Button>
        </div>
      </figcaption>
    </figure>
  );
}

export function IdeaCards({ ideas }: { ideas: ChatIdea[] }) {
  const { meta } = useApp();
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const remaining = ideas.map((_, i) => i).filter((i) => !added.has(i));
  const column = meta.columns[0]?.name ?? "la première colonne";

  function add(indexes: number[]) {
    const defaults = defaultPostPlatforms(meta.accounts);
    startTransition(async () => {
      const result = await createPostsFromIdeas({
        ideas: indexes.map((i) => ideas[i]),
        pillarId: null,
        platforms: defaults.length ? defaults : usedPlatforms(meta.accounts),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAdded((prev) => new Set([...prev, ...indexes]));
      toast.success(`${result.data.count} idée(s) ajoutée(s) dans « ${column} »`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {ideas.map((idea, index) => (
        <div key={index} className="flex flex-col gap-1 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Lightbulb className="size-4 text-warning" />
            <span className="text-sm font-medium">{idea.title}</span>
            <Badge variant="outline" className="text-[10px]">
              {formatLabel(idea.format)}
            </Badge>
            <Button
              size="sm"
              variant={added.has(index) ? "ghost" : "outline"}
              className="ml-auto"
              disabled={added.has(index) || pending}
              onClick={() => add([index])}
            >
              {added.has(index) ? <Check /> : <Plus />}
              {added.has(index) ? "Ajoutée" : "Au tableau"}
            </Button>
          </div>
          {idea.hook && <p className="text-sm">« {idea.hook} »</p>}
          {idea.angle && <p className="text-xs text-muted-foreground">{idea.angle}</p>}
        </div>
      ))}
      {remaining.length > 1 && (
        <Button size="sm" variant="secondary" className="self-start" disabled={pending} onClick={() => add(remaining)}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Ajouter les {remaining.length} idées au tableau
        </Button>
      )}
    </div>
  );
}
