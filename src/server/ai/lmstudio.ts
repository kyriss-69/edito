import "server-only";

import { findModel, parseModelCapabilities, type ModelCapabilities } from "@/lib/ai/media";
import { createSseParser, isInsideReasoning } from "@/lib/ai/parse";
import { activeModel, normalizeBaseUrl, OPENROUTER_URL, type AiSettings } from "@/lib/ai/settings";
import type { AgentMessage, ToolCall, ToolDefinition } from "@/lib/ai/chat";
import { getOpenRouterKey } from "@/server/settings";

/** Erreur à afficher telle quelle à l'utilisateur. */
export class AiError extends Error {}

export type AiPhase = "waiting" | "thinking" | "writing";

function isAbort(error: unknown) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

/** Où envoyer les demandes : LM Studio (local) ou OpenRouter (clé d'API). */
type Connection = { label: string; url: string; headers: Record<string, string> };

function connectionFor(provider: AiSettings["provider"], baseUrl: string, key = getOpenRouterKey()): Connection {
  if (provider === "openrouter") {
    if (!key) throw new AiError("Ajoute ta clé d'API OpenRouter dans Réglages › Assistant IA.");
    return {
      label: "OpenRouter",
      url: OPENROUTER_URL,
      // Referer et titre : l'app apparaît sous son nom dans le tableau de bord d'OpenRouter.
      headers: { Authorization: `Bearer ${key}`, "HTTP-Referer": "http://localhost", "X-Title": "Édito" },
    };
  }
  return { label: "LM Studio", url: normalizeBaseUrl(baseUrl), headers: {} };
}

function connectionError(connection: Connection, error: unknown): Error {
  if (isAbort(error)) return error as Error;
  if (connection.label === "OpenRouter") {
    return new AiError("OpenRouter ne répond pas. Vérifie ta connexion à internet, puis réessaie.");
  }
  return new AiError(
    `LM Studio ne répond pas à ${connection.url}. Vérifie que LM Studio est ouvert et que le serveur local est démarré (onglet Developer → Start Server).`,
  );
}

async function readError(res: Response) {
  const body = (await res.json().catch(() => null)) as
    | { error?: string | { message?: string } }
    | null;
  const message = typeof body?.error === "string" ? body.error : body?.error?.message;
  return message ?? `${res.status} ${res.statusText}`;
}

/** Modèles disponibles dans LM Studio (hors modèles d'embedding). */
export async function listModels(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
  const connection = connectionFor("lmstudio", baseUrl);
  let res: Response;
  try {
    res = await fetch(`${connection.url}/v1/models`, { signal, cache: "no-store" });
  } catch (error) {
    throw connectionError(connection, error);
  }
  if (!res.ok) throw new AiError(`LM Studio a répondu : ${await readError(res)}`);
  const body = (await res.json()) as { data?: { id: string }[] };
  return (body.data ?? []).map((m) => m.id).filter((id) => !/embed/i.test(id));
}

type OpenRouterModel = {
  id: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
};

/**
 * Modèles d'OpenRouter qui savent appeler des outils (recherche web de
 * l'assistant), avec leurs capacités. Liste publique : la clé sert seulement
 * à vérifier qu'elle est valable (`key` : clé à tester, sinon celle enregistrée).
 */
export async function listOpenRouterModels(
  signal?: AbortSignal,
  key = getOpenRouterKey(),
): Promise<{ models: string[]; capabilities: ModelCapabilities[] }> {
  const connection = connectionFor("openrouter", "", key);
  let res: Response;
  try {
    const check = await fetch(`${connection.url}/v1/key`, { headers: connection.headers, signal, cache: "no-store" });
    if (check.status === 401) throw new AiError("Clé d'API OpenRouter refusée : vérifie-la sur openrouter.ai/keys.");
    res = await fetch(`${connection.url}/v1/models`, { signal, cache: "no-store" });
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw connectionError(connection, error);
  }
  if (!res.ok) throw new AiError(`OpenRouter a répondu : ${await readError(res)}`);
  const body = (await res.json()) as { data?: OpenRouterModel[] };
  const models = (body.data ?? []).filter((m) => m.supported_parameters?.includes("tools"));
  return {
    models: models.map((m) => m.id).sort((a, b) => Number(!a.endsWith(":free")) - Number(!b.endsWith(":free")) || a.localeCompare(b)),
    capabilities: models.map((m) => ({
      ids: [m.id],
      vision: m.architecture?.input_modalities ? m.architecture.input_modalities.includes("image") : null,
      contextLength: m.context_length ?? null,
    })),
  };
}

/**
 * Capacités des modèles (vision, contexte), lues dans l'API REST de LM Studio.
 * Renvoie une liste vide si LM Studio ne les fournit pas : ce n'est pas bloquant.
 */
export async function listModelCapabilities(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<ModelCapabilities[]> {
  const url = normalizeBaseUrl(baseUrl);
  for (const path of ["/api/v1/models", "/api/v0/models"]) {
    try {
      const res = await fetch(`${url}${path}`, { signal, cache: "no-store" });
      if (!res.ok) continue;
      const models = parseModelCapabilities(await res.json());
      if (models.length) return models;
    } catch {
      if (signal?.aborted) return [];
    }
  }
  return [];
}

export async function getModelCapabilities(settings: AiSettings, signal?: AbortSignal) {
  if (settings.provider === "openrouter") {
    const { capabilities } = await listOpenRouterModels(signal).catch(() => ({ capabilities: [] }));
    return findModel(capabilities, settings.openrouterModel);
  }
  return findModel(await listModelCapabilities(settings.baseUrl, signal), settings.model);
}

type ToolCallDelta = {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
};
type ChunkDelta = {
  content?: string | null;
  reasoning_content?: string | null;
  /** Réflexion des modèles « reasoning » sur OpenRouter. */
  reasoning?: string | null;
  tool_calls?: ToolCallDelta[];
};
type Chunk = {
  choices?: { delta?: ChunkDelta; finish_reason?: string | null }[];
  error?: string | { message?: string };
};

/**
 * Envoie une conversation au modèle (LM Studio ou OpenRouter) en streaming et renvoie le texte final.
 * `onProgress` indique si le modèle réfléchit encore ou rédige sa réponse ;
 * `onContent` reçoit le texte reçu jusque-là. Avec `tools`, le modèle peut
 * demander à appeler des outils (`toolCalls`).
 */
export async function chatCompletion({
  settings,
  messages,
  signal,
  onProgress,
  onContent,
  tools,
}: {
  settings: AiSettings;
  messages: AgentMessage[];
  signal: AbortSignal;
  onProgress: (phase: AiPhase, chars: number) => void;
  onContent?: (content: string) => void;
  tools?: ToolDefinition[];
}): Promise<{ content: string; finishReason: string | null; toolCalls: ToolCall[] }> {
  const connection = connectionFor(settings.provider, settings.baseUrl);
  let res: Response;
  try {
    res = await fetch(`${connection.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...connection.headers },
      body: JSON.stringify({
        model: activeModel(settings),
        messages,
        temperature: settings.temperature,
        // Les modèles « reasoning » ont besoin de place pour réfléchir avant de répondre.
        max_tokens: 8192,
        stream: true,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      }),
      signal,
    });
  } catch (error) {
    throw connectionError(connection, error);
  }
  if (!res.ok || !res.body) {
    if (res.status === 429) {
      throw new AiError(
        `${connection.label} : limite de demandes atteinte (sur OpenRouter, 50 par jour avec les modèles gratuits). Réessaie plus tard ou repasse sur LM Studio.`,
      );
    }
    throw new AiError(`${connection.label} a refusé la demande : ${await readError(res)}`);
  }

  let content = "";
  let chars = 0;
  let finishReason: string | null = null;
  let streamError: string | null = null;
  const calls: { id: string; name: string; arguments: string }[] = [];

  const push = createSseParser((data) => {
    if (data === "[DONE]") return;
    let chunk: Chunk;
    try {
      chunk = JSON.parse(data) as Chunk;
    } catch {
      return;
    }
    if (chunk.error) {
      streamError = typeof chunk.error === "string" ? chunk.error : (chunk.error.message ?? "erreur inconnue");
      return;
    }
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const reasoning = choice.delta?.reasoning_content ?? choice.delta?.reasoning ?? "";
    const text = choice.delta?.content ?? "";
    chars += reasoning.length + text.length;
    content += text;
    for (const delta of choice.delta?.tool_calls ?? []) {
      const index = delta.index ?? calls.length - 1;
      calls[index] ??= { id: "", name: "", arguments: "" };
      const call = calls[index];
      if (delta.id) call.id = delta.id;
      if (delta.function?.name) call.name += delta.function.name;
      if (delta.function?.arguments) {
        call.arguments += delta.function.arguments;
        chars += delta.function.arguments.length;
      }
      onProgress("writing", chars);
    }
    if (reasoning || text) {
      onProgress(reasoning || isInsideReasoning(content) ? "thinking" : "writing", chars);
      if (text) onContent?.(content);
    }
  });

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    push(decoder.decode(value, { stream: true }));
  }
  push("\n");

  if (streamError) throw new AiError(`Erreur de ${connection.label} : ${streamError}`);
  const toolCalls = calls
    .filter((call) => call?.name)
    .map((call, i) => ({
      id: call.id || `call_${i}_${Date.now()}`,
      type: "function" as const,
      function: { name: call.name, arguments: call.arguments },
    }));
  return { content, finishReason, toolCalls };
}
