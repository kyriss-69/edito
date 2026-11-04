"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AiTaskId, AiTaskInput, AiTaskOutput } from "@/lib/ai/tasks";

export type AiPhase = "waiting" | "thinking" | "writing";

type StreamEvent =
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

export type AiTaskState<T extends AiTaskId> =
  | { status: "idle" }
  | { status: "running"; phase: AiPhase; startedAt: number }
  | { status: "done"; result: AiTaskOutput<T> }
  | { status: "error"; error: string };

/** Lance une tâche de l'assistant IA et suit sa progression. */
export function useAiTask<T extends AiTaskId>(task: T) {
  const [state, setState] = useState<AiTaskState<T>>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (input: AiTaskInput<T>): Promise<AiTaskOutput<T> | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const startedAt = Date.now();
      setState({ status: "running", phase: "waiting", startedAt });

      const fail = (error: string) => {
        if (!controller.signal.aborted) setState({ status: "error", error });
        return null;
      };

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task, input }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          return fail(body?.error ?? "L'assistant n'a pas pu répondre.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;
            if (event.type === "progress") {
              setState({ status: "running", phase: event.phase, startedAt });
            } else if (event.type === "error") {
              return fail(event.message);
            } else {
              const result = event.data as AiTaskOutput<T>;
              setState({ status: "done", result });
              return result;
            }
          }
        }
        return fail("La connexion avec l'assistant a été interrompue.");
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return null;
        return fail("Impossible de contacter l'assistant.");
      } finally {
        if (controllerRef.current === controller) controllerRef.current = null;
      }
    },
    [task],
  );

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, cancel, reset };
}
