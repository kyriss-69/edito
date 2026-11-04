"use client";

import { ExternalLink, Globe, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { ResearchStreamEvent } from "@/app/api/ai/research/route";
import { ChatSteps } from "@/components/assistant/chat-steps";
import { useApp } from "@/components/app-provider";
import type { Draft } from "@/components/posts/post-editor";
import { Section } from "@/components/posts/editor-section";
import { Button } from "@/components/ui/button";
import { CharCounter } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChatStep } from "@/lib/ai/chat";
import { RESEARCH_NOTES_MAX } from "@/lib/ai/research";
import { displayUrl } from "@/lib/web";

import { AiError, AiProgress } from "./ai-progress";
import { useAiReady, usePostContext } from "./caption-assistant";
import { readNdjson, responseError } from "./ndjson";
import type { AiPhase } from "./use-ai-task";

type Update = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

type Run =
  | { status: "idle" }
  | { status: "running"; phase: AiPhase; startedAt: number; steps: ChatStep[] }
  | { status: "error"; message: string };

/**
 * Recherches web d'un post : l'assistant cherche et lit quelques pages sur le
 * sujet, puis garde des notes sourcées, envoyées ensuite à toutes les
 * rédactions IA du post (légendes, adaptation, analyse des médias).
 */
export function PostResearch({ draft, update }: { draft: Draft; update: Update }) {
  const { meta } = useApp();
  const ready = useAiReady();
  const post = usePostContext(draft);
  const [instruction, setInstruction] = useState("");
  const [run, setRun] = useState<Run>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => () => controllerRef.current?.abort(), []);

  const research = draft.research;
  const webEnabled = meta.ai.web.enabled;
  const running = run.status === "running";

  async function start() {
    if (!ready()) return;
    if (!draft.title.trim() && !draft.notes.trim() && !instruction.trim()) {
      setRun({ status: "error", message: "Donne d'abord un titre ou des notes au post, ou précise quoi chercher." });
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = Date.now();
    setRun({ status: "running", phase: "waiting", startedAt, steps: [] });
    try {
      const res = await fetch("/api/ai/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post: { ...post, research: "" }, instruction }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setRun({ status: "error", message: await responseError(res, "La recherche a échoué.") });
        return;
      }
      let finished = false;
      await readNdjson<ResearchStreamEvent>(res, (event) => {
        if (event.type === "progress") {
          setRun((prev) => (prev.status === "running" ? { ...prev, phase: event.phase } : prev));
        } else if (event.type === "step") {
          setRun((prev) => {
            if (prev.status !== "running") return prev;
            const steps = prev.steps.some((s) => s.id === event.step.id)
              ? prev.steps.map((s) => (s.id === event.step.id ? event.step : s))
              : [...prev.steps, event.step];
            return { ...prev, steps };
          });
        } else if (event.type === "error") {
          finished = true;
          setRun({ status: "error", message: event.message });
        } else {
          finished = true;
          setRun({ status: "idle" });
          update("research", event.research);
        }
      });
      if (!finished && !controller.signal.aborted) {
        setRun({ status: "error", message: "La connexion a été interrompue." });
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setRun({ status: "error", message: "Impossible de lancer la recherche." });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }

  function cancel() {
    controllerRef.current?.abort();
    setRun({ status: "idle" });
  }

  return (
    <Section
      title="Recherches"
      description="L'assistant cherche sur internet (faits, tendances, angles, hashtags) ; ses notes servent ensuite à toutes les rédactions IA du post."
      action={
        research && !running ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update("research", null)}
            aria-label="Effacer les recherches"
          >
            <Trash2 /> Effacer
          </Button>
        ) : undefined
      }
    >
      {!webEnabled ? (
        <p className="text-sm text-muted-foreground">
          L&apos;accès à internet est désactivé.{" "}
          <Link href="/settings/ai" className="underline underline-offset-2">
            Active-le dans Réglages › Assistant IA
          </Link>
          .
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Facultatif : quoi chercher (ex. chiffres 2026 sur l'UGC)"
            aria-label="Ce qu'il faut chercher"
            disabled={running}
            maxLength={1_000}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void start();
              }
            }}
          />
          <Button variant="outline" onClick={() => void start()} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : research ? <RefreshCw /> : <Search />}
            {research ? "Relancer" : "Rechercher"}
          </Button>
        </div>
      )}

      {run.status === "running" && (
        <div className="flex flex-col gap-2">
          <AiProgress phase={run.phase} startedAt={run.startedAt} onCancel={cancel} />
          {run.steps.length > 0 && <ChatSteps steps={run.steps} />}
        </div>
      )}
      {run.status === "error" && <AiError message={run.message} onRetry={webEnabled ? () => void start() : undefined} />}

      {research && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={research.notes}
            onChange={(e) => update("research", { ...research, notes: e.target.value })}
            aria-label="Notes de recherche"
            className="min-h-32 text-sm"
            maxLength={RESEARCH_NOTES_MAX}
          />
          <div className="flex items-start justify-between gap-2">
            {research.sources.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs">
                {research.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    >
                      <Globe className="size-3 shrink-0" />
                      <span className="line-clamp-1">{source.title || displayUrl(source.url)}</span>
                      <span className="shrink-0 opacity-70">· {displayUrl(source.url)}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-muted-foreground">Aucune source.</span>
            )}
            <CharCounter value={research.notes} max={RESEARCH_NOTES_MAX} />
          </div>
          <p className="text-xs text-muted-foreground">
            Recherche du {new Date(research.at).toLocaleDateString("fr-FR")}. Relis les notes : l&apos;assistant ne
            citera que ces faits.
          </p>
        </div>
      )}
    </Section>
  );
}
