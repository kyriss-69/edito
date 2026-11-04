import { z } from "zod";

import { activeModel } from "@/lib/ai/settings";
import { researchTools, type ChatStep } from "@/lib/ai/chat";
import {
  buildResearchMessages,
  clampNotes,
  pickSources,
  RESEARCH_MAX_TOOL_CALLS,
  type PostResearch,
  type ResearchSource,
} from "@/lib/ai/research";
import { postContextSchema } from "@/lib/ai/tasks";
import { runToolLoop } from "@/server/ai/agent";
import { getBrandContext } from "@/server/ai/context";
import type { AiPhase } from "@/server/ai/lmstudio";
import { errorMessage, ndjsonResponse } from "@/server/ai/run-task";
import { getAiSettings } from "@/server/settings";

/** Quelques recherches et pages lues avec un modèle local. */
const TIMEOUT_MS = 8 * 60 * 1000;

export type ResearchStreamEvent =
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "step"; step: ChatStep }
  | { type: "done"; research: PostResearch }
  | { type: "error"; message: string };

const inputSchema = z.object({
  post: postContextSchema,
  instruction: z.string().max(1_000).default(""),
});

/** Recherches web d'un post : l'agent cherche, lit quelques pages et rend des notes sourcées. */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Demande invalide" }, { status: 400 });
  }
  const settings = getAiSettings();
  if (!activeModel(settings)) {
    return Response.json({ error: "Aucun modèle choisi : configure l'assistant dans Réglages." }, { status: 400 });
  }
  if (!settings.web.enabled) {
    return Response.json(
      { error: "L'accès à internet est désactivé : active-le dans Réglages › Assistant IA." },
      { status: 400 },
    );
  }

  const { system, user } = buildResearchMessages(parsed.data.post, getBrandContext(settings), {
    today: new Date(),
    instruction: parsed.data.instruction,
  });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);

  return ndjsonResponse<ResearchStreamEvent>(async (send) => {
    try {
      send({ type: "progress", phase: "waiting", chars: 0 });
      const result = await runToolLoop({
        settings,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: researchTools(),
        web: true,
        maxToolCalls: RESEARCH_MAX_TOOL_CALLS,
        signal,
        events: {
          onProgress: (phase, chars) => send({ type: "progress", phase, chars }),
          onText: () => {},
          onStep: (step) => send({ type: "step", step }),
        },
      });
      const notes = clampNotes(result.last);
      if (!notes) throw new Error("empty");
      const done = result.steps.filter((s) => s.status === "done");
      const read: ResearchSource[] = done.filter((s) => s.tool === "read_page").flatMap((s) => s.links ?? []);
      const found: ResearchSource[] = done
        .filter((s) => s.tool === "web_search")
        .flatMap((s) => (s.links ?? []).slice(0, 2));
      send({ type: "done", research: { notes, sources: pickSources(read, found), at: Date.now() } });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "empty"
          ? "Le modèle n'a pas rendu de notes. Réessaie, ou précise ce qu'il faut chercher."
          : (errorMessage(error, 8) ?? "Recherche arrêtée.");
      send({ type: "error", message });
    }
  });
}
