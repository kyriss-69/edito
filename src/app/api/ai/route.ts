import { activeModel } from "@/lib/ai/settings";
import { buildTaskMessages, isAiTaskId } from "@/lib/ai/tasks";
import { AiError, getModelCapabilities, type AiPhase } from "@/server/ai/lmstudio";
import { errorMessage, ndjsonResponse, runTask, throttleProgress } from "@/server/ai/run-task";
import { getBrandContext } from "@/server/ai/context";
import { getAiSettings } from "@/server/settings";

/** Au-delà, on abandonne (un modèle local lent peut réfléchir longtemps). */
const TIMEOUT_MS = 5 * 60 * 1000;

export type AiStreamEvent =
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

/**
 * Exécute une tâche de l'assistant (légendes, hashtags, idées…) avec le modèle
 * local, et renvoie la progression puis le résultat en NDJSON.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { task?: unknown; input?: unknown } | null;
  if (!body || !isAiTaskId(body.task)) {
    return Response.json({ error: "Tâche inconnue" }, { status: 400 });
  }
  const task = body.task;

  const settings = getAiSettings();
  if (!activeModel(settings)) {
    return Response.json(
      { error: "Aucun modèle choisi : configure l'assistant dans Réglages." },
      { status: 400 },
    );
  }

  const built = buildTaskMessages(task, body.input, getBrandContext(settings));
  if (!built.ok) return Response.json({ error: built.error }, { status: 400 });

  const withImages = task === "mediaAnalysis";
  let contextLength: number | null = null;
  if (withImages) {
    const model = await getModelCapabilities(settings, AbortSignal.timeout(5_000));
    contextLength = model?.contextLength ?? null;
    if (model?.vision === false) {
      return Response.json({ error: noVisionMessage(activeModel(settings)) }, { status: 400 });
    }
  }

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]);

  return ndjsonResponse<AiStreamEvent>(async (send) => {
    try {
      send({ type: "progress", phase: "waiting", chars: 0 });
      const data = await runTask({
        task,
        messages: built.messages,
        settings,
        signal,
        onProgress: throttleProgress((phase, chars) => send({ type: "progress", phase, chars })),
      });
      send({ type: "result", data });
    } catch (error) {
      const message = errorMessage(error);
      if (message === null) return;
      send({
        type: "error",
        message: withImages && error instanceof AiError ? explainImageError(message, contextLength) : message,
      });
    }
  });
}

function noVisionMessage(model: string) {
  return `Le modèle « ${model} » ne sait pas lire les images. Dans LM Studio, charge un modèle avec le badge « Vision » (par exemple Ministral 3, Gemma 3 ou Qwen2.5-VL), puis choisis-le dans Réglages.`;
}

/** Ajoute une piste de solution aux erreurs de LM Studio liées aux images. */
function explainImageError(message: string, contextLength: number | null) {
  if (/context|token/i.test(message)) {
    const current = contextLength ? ` (actuellement ${contextLength} tokens)` : "";
    return `${message}\nLes images prennent beaucoup de place : augmente la longueur de contexte du modèle dans LM Studio${current}, à 8192 ou plus, ou analyse moins de médias.`;
  }
  if (/image|vision|multimodal|mmproj/i.test(message)) {
    return `${message}\nVérifie que le modèle chargé dans LM Studio gère les images (badge « Vision »).`;
  }
  return message;
}
