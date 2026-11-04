"use client";

import { Loader2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { activeModel } from "@/lib/ai/settings";
import { cn } from "@/lib/utils";

import type { AiPhase } from "./use-ai-task";

const PHASE_LABEL: Record<AiPhase, string> = {
  waiting: "Connexion à LM Studio…",
  thinking: "Le modèle réfléchit…",
  writing: "Rédaction en cours…",
};

/** Indicateur de progression d'une génération, avec bouton d'annulation. */
export function AiProgress({
  phase,
  startedAt,
  onCancel,
  className,
}: {
  phase: AiPhase;
  startedAt: number;
  onCancel: () => void;
  className?: string;
}) {
  const { meta } = useApp();
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm",
        className,
      )}
    >
      <Loader2 className="size-4 animate-spin text-primary" />
      <span className="font-medium">{PHASE_LABEL[phase]}</span>
      <span className="text-muted-foreground tabular-nums">{seconds} s</span>
      <span className="truncate text-xs text-muted-foreground max-sm:hidden">· {activeModel(meta.ai)}</span>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onCancel}>
        <X /> Annuler
      </Button>
    </div>
  );
}

export function AiError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <span className="flex-1 whitespace-pre-line">{message}</span>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function AiIcon({ className }: { className?: string }) {
  return <Sparkles className={cn("text-primary", className)} />;
}
