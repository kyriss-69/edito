import "server-only";

import {
  buildChatSystemPrompt,
  CHAT_MAX_TOOL_CALLS,
  CHAT_PAGE_CHARS,
  chatTools,
  historyMessages,
  parseToolCall,
  type AgentMessage,
  type ChatContext,
  type ChatEntry,
  type ChatStep,
  type ParsedToolCall,
  type ToolDefinition,
} from "@/lib/ai/chat";
import { stripReasoning } from "@/lib/ai/parse";
import type { AiSettings } from "@/lib/ai/settings";
import { displayUrl, formatSearchResults, normalizeUrl } from "@/lib/web";
import { readPage, WebError } from "@/server/web/browser";
import { captureToLibrary } from "@/server/web/captures";
import { searchWeb } from "@/server/web/search";

import { AiError, chatCompletion, type AiPhase } from "./lmstudio";
import { throttleProgress } from "./run-task";

export type AgentEvents = {
  onProgress: (phase: AiPhase, chars: number) => void;
  /** Texte de la réponse, au fil de l'eau (texte complet à chaque fois). */
  onText: (text: string) => void;
  /** Étape ajoutée ou mise à jour (même `id`). */
  onStep: (step: ChatStep) => void;
};

let stepCounter = 0;
const newStepId = () => `step-${Date.now().toString(36)}-${(stepCounter++).toString(36)}`;

function stepLabel(call: ParsedToolCall): string {
  if (!call.ok) return `Outil ${call.name}`;
  switch (call.name) {
    case "web_search":
      return `Recherche : ${call.input.query}`;
    case "read_page":
      return `Lecture de ${displayUrl(normalizeUrl(call.input.url) ?? call.input.url)}`;
    case "take_screenshot":
      return `Capture de ${displayUrl(normalizeUrl(call.input.url) ?? call.input.url)} (${call.input.device === "mobile" ? "téléphone" : "ordinateur"})`;
    case "propose_post_ideas":
      return `${call.input.ideas.length} idée(s) de posts`;
  }
}

/** Exécute un outil et renvoie ce qu'on en dit au modèle, en mettant à jour l'étape affichée. */
async function runTool(
  call: ParsedToolCall,
  step: ChatStep,
  { web, signal }: { web: boolean; signal: AbortSignal },
): Promise<string> {
  if (!call.ok) {
    Object.assign(step, { status: "error", detail: call.error });
    return `Erreur : ${call.error}`;
  }
  if (call.name !== "propose_post_ideas" && !web) {
    Object.assign(step, { status: "error", detail: "Accès à internet désactivé" });
    return "Erreur : l'accès à internet est désactivé dans les réglages.";
  }
  try {
    switch (call.name) {
      case "web_search": {
        const results = await searchWeb(call.input.query, signal);
        Object.assign(step, {
          status: "done",
          detail: `${results.length} résultat(s)`,
          links: results.map(({ title, url }) => ({ title, url })),
        });
        return formatSearchResults(call.input.query, results);
      }
      case "read_page": {
        const url = normalizeUrl(call.input.url);
        if (!url) throw new WebError(`Adresse invalide : ${call.input.url}`);
        const page = await readPage(url, { maxChars: CHAT_PAGE_CHARS, signal });
        Object.assign(step, { status: "done", links: [{ title: page.title || displayUrl(page.url), url: page.url }] });
        const links = page.links.slice(0, 25).map((l) => `- ${l.label || "(sans texte)"} : ${l.url}`);
        return [
          `Page : ${page.title} (${page.url})`,
          '"""',
          page.text,
          '"""',
          links.length ? `Liens internes de la page :\n${links.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      }
      case "take_screenshot": {
        const url = normalizeUrl(call.input.url);
        if (!url) throw new WebError(`Adresse invalide : ${call.input.url}`);
        const focusText = call.input.focus_text?.trim() ?? "";
        const capture = await captureToLibrary({
          url,
          device: call.input.device,
          mode: call.input.mode === "element" && focusText ? "element" : "page",
          focusText,
          title: call.input.title ?? "",
          signal,
        });
        Object.assign(step, {
          status: "done",
          capture: { assetId: capture.assetId, title: capture.title, url: capture.url, device: capture.device },
        });
        return `Capture enregistrée dans la médiathèque sous le titre « ${capture.title} » (${capture.width} × ${capture.height} px). L'utilisateur la voit dans la discussion et peut la placer sur une slide dans le Studio.`;
      }
      case "propose_post_ideas": {
        Object.assign(step, { status: "done", ideas: call.input.ideas });
        return "Les idées sont affichées à l'utilisateur sous forme de cartes, avec un bouton pour les ajouter au tableau. Ne les recopie pas : commente-les en quelques mots ou demande ce qu'il en pense.";
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    const message = error instanceof WebError ? error.message : "l'outil a échoué";
    if (!(error instanceof WebError)) console.error("[assistant] outil", call.name, error);
    Object.assign(step, { status: "error", detail: message });
    return `Erreur : ${message}`;
  }
}

/**
 * Boucle d'appels d'outils : le modèle appelle des outils jusqu'à répondre en
 * texte. Au-delà de `maxToolCalls`, il doit répondre avec ce qu'il a.
 */
export async function runToolLoop({
  settings,
  messages,
  tools,
  web,
  maxToolCalls,
  signal,
  events,
}: {
  settings: AiSettings;
  messages: AgentMessage[];
  tools: ToolDefinition[];
  web: boolean;
  maxToolCalls: number;
  signal: AbortSignal;
  events: AgentEvents;
}): Promise<{ content: string; last: string; steps: ChatStep[] }> {
  const steps: ChatStep[] = [];
  const texts: string[] = [];
  let toolCallCount = 0;
  const onProgress = throttleProgress(events.onProgress);
  const join = (current: string) => [...texts, current].map((t) => t.trim()).filter(Boolean).join("\n\n");

  for (;;) {
    const allowTools = toolCallCount < maxToolCalls;
    const { content, finishReason, toolCalls } = await chatCompletion({
      settings,
      messages,
      signal,
      onProgress,
      onContent: (raw) => events.onText(join(stripReasoning(raw))),
      tools: allowTools ? tools : undefined,
    });
    const text = stripReasoning(content);

    if (!toolCalls.length) {
      if (!text && finishReason === "length") {
        throw new AiError(
          "Le modèle a atteint sa limite de longueur avant de répondre. Augmente la longueur de contexte du modèle dans LM Studio (16 000 tokens ou plus conseillé avec les outils), puis réessaie.",
        );
      }
      texts.push(text);
      const final = join("");
      events.onText(final);
      return { content: final, last: text, steps };
    }

    texts.push(text);
    messages.push({ role: "assistant", content: text || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      toolCallCount++;
      const parsed = parseToolCall(call.function.name, call.function.arguments);
      const step: ChatStep = {
        id: newStepId(),
        tool: parsed.ok ? parsed.name : "web_search",
        status: "running",
        label: stepLabel(parsed),
      };
      steps.push(step);
      events.onStep({ ...step });
      const allowed = parsed.ok ? tools.some((t) => t.function.name === parsed.name) : true;
      const result =
        toolCallCount > maxToolCalls
          ? "Erreur : trop d'appels d'outils pour cette réponse. Réponds avec ce que tu as déjà."
          : !allowed
            ? "Erreur : cet outil n'est pas disponible ici."
            : await runTool(parsed, step, { web, signal });
      if (toolCallCount > maxToolCalls) Object.assign(step, { status: "error", detail: "Limite d'outils atteinte" });
      else if (!allowed) Object.assign(step, { status: "error", detail: "Outil non disponible" });
      events.onStep({ ...step });
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
}

/**
 * Répond au dernier message de la discussion. Le modèle peut appeler des
 * outils (recherche, lecture de pages, captures, idées) avant de répondre.
 * Renvoie la réponse complète, à enregistrer.
 */
export async function runAgent({
  settings,
  context,
  entries,
  signal,
  events,
}: {
  settings: AiSettings;
  context: ChatContext;
  entries: ChatEntry[];
  signal: AbortSignal;
  events: AgentEvents;
}): Promise<{ content: string; steps: ChatStep[] }> {
  return runToolLoop({
    settings,
    messages: [{ role: "system", content: buildChatSystemPrompt(context) }, ...historyMessages(entries)],
    tools: chatTools({ web: context.web }),
    web: context.web,
    maxToolCalls: CHAT_MAX_TOOL_CALLS,
    signal,
    events,
  });
}
