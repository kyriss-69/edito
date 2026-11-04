import "server-only";

import { stripReasoning } from "@/lib/ai/parse";
import type { AiSettings } from "@/lib/ai/settings";
import { parseTaskOutput, type AiTaskId, type AiTaskOutput, type ChatMessage } from "@/lib/ai/tasks";

import { AiError, chatCompletion, type AiPhase } from "./lmstudio";

/**
 * Envoie une tâche au modèle et lit sa réponse JSON. Deux essais : si la
 * première réponse n'est pas au bon format, on le signale au modèle.
 */
export async function runTask<T extends AiTaskId>({
  task,
  messages: initial,
  settings,
  signal,
  onProgress,
}: {
  task: T;
  messages: ChatMessage[];
  settings: AiSettings;
  signal: AbortSignal;
  onProgress: (phase: AiPhase, chars: number) => void;
}): Promise<AiTaskOutput<T>> {
  const messages = [...initial];
  for (let attempt = 0; attempt < 2; attempt++) {
    const { content, finishReason } = await chatCompletion({ settings, messages, signal, onProgress });
    const data = parseTaskOutput(task, content);
    if (data) return data;
    const answer = stripReasoning(content);
    if (finishReason === "length" && !answer) {
      throw new AiError(
        "Le modèle a atteint sa limite de longueur avant de répondre. Augmente la longueur de contexte du modèle dans LM Studio, puis réessaie.",
      );
    }
    messages.push(
      { role: "assistant", content: answer || "(réponse vide)" },
      {
        role: "user",
        content:
          "Ta réponse n'est pas un objet JSON valide au format demandé. Renvoie uniquement l'objet JSON, sans aucun texte autour.",
      },
    );
  }
  throw new AiError("Le modèle n'a pas renvoyé de réponse exploitable. Réessaie ou reformule la demande.");
}

/** Limite les événements de progression à un tous les 250 ms. */
export function throttleProgress(send: (phase: AiPhase, chars: number) => void) {
  let last = 0;
  return (phase: AiPhase, chars: number) => {
    const now = Date.now();
    if (now - last < 250) return;
    last = now;
    send(phase, chars);
  };
}

/** Réponse en NDJSON : un objet JSON par ligne, envoyé au fil de l'eau. */
export function ndjsonResponse<E>(run: (send: (event: E) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: E) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Le client est parti.
        }
      };
      try {
        await run(send);
      } finally {
        try {
          controller.close();
        } catch {
          // Déjà fermé.
        }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Message d'erreur lisible pour l'utilisateur, ou `null` si la demande a été annulée. */
export function errorMessage(error: unknown, timeoutMinutes = 5): string | null {
  if (error instanceof AiError) return error.message;
  if (error instanceof Error && error.name === "TimeoutError") {
    return `Le modèle a mis trop de temps à répondre (plus de ${timeoutMinutes} minutes).`;
  }
  if (error instanceof Error && error.name === "AbortError") return null;
  console.error("[assistant IA]", error);
  return "Erreur inattendue de l'assistant.";
}
