/**
 * Préparation des médias envoyés à un modèle « vision » : nombre d'images par
 * média, instants extraits des vidéos et taille des images.
 */

/** Images envoyées au maximum : chacune occupe une bonne part du contexte du modèle. */
export const MAX_ANALYSIS_IMAGES = 6;
/** Images extraites au maximum d'une même vidéo. */
export const MAX_FRAMES_PER_VIDEO = 4;
/** Plus grand côté des images envoyées, en pixels. */
export const ANALYSIS_IMAGE_SIDE = 768;

export type MediaKind = "image" | "video";

export function mediaKind(mimeType: string): MediaKind {
  return mimeType.startsWith("video/") ? "video" : "image";
}

/**
 * Nombre d'images à envoyer pour chaque média (0 = non analysé) : une par
 * média dans l'ordre, puis le reste du budget en images de plus pour les vidéos.
 */
export function planFrames(kinds: readonly MediaKind[], max = MAX_ANALYSIS_IMAGES): number[] {
  const counts = kinds.map(() => 0);
  let budget = max;
  for (let i = 0; i < kinds.length && budget > 0; i++) {
    counts[i] = 1;
    budget--;
  }
  let progress = true;
  while (budget > 0 && progress) {
    progress = false;
    for (let i = 0; i < kinds.length && budget > 0; i++) {
      if (kinds[i] !== "video" || counts[i] === 0 || counts[i] >= MAX_FRAMES_PER_VIDEO) continue;
      counts[i]++;
      budget--;
      progress = true;
    }
  }
  return counts;
}

/** Instants (en secondes) des images à extraire, répartis sur toute la vidéo. */
export function frameTimes(duration: number, count: number): number[] {
  if (!Number.isFinite(duration) || duration <= 0 || count < 1) return [0];
  return Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) / count) * duration * 10) / 10);
}

/** Dimensions réduites pour que le plus grand côté ne dépasse pas `max`. */
export function fitWithin(width: number, height: number, max = ANALYSIS_IMAGE_SIDE) {
  const w = width > 0 ? width : max;
  const h = height > 0 ? height : max;
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** 7.4 → "0:07", 75 → "1:15" */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Capacités des modèles LM Studio                                    */
/* ------------------------------------------------------------------ */

export type ModelCapabilities = {
  /** Identifiants sous lesquels le modèle apparaît (clé, instances chargées). */
  ids: string[];
  /** `null` si LM Studio ne le précise pas. */
  vision: boolean | null;
  /** Longueur de contexte du modèle chargé, si connue. */
  contextLength: number | null;
};

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === "object" && value !== null;
const str = (value: unknown) => (typeof value === "string" && value ? [value] : []);

/**
 * Lit la liste des modèles de l'API REST de LM Studio : `/api/v1/models`
 * (`capabilities.vision`) ou, sur les versions plus anciennes, `/api/v0/models`
 * (`type: "vlm"`).
 */
export function parseModelCapabilities(body: unknown): ModelCapabilities[] {
  if (!isObj(body)) return [];
  if (Array.isArray(body.models)) {
    return body.models.filter(isObj).map((m) => {
      const instances = Array.isArray(m.loaded_instances) ? m.loaded_instances.filter(isObj) : [];
      const contexts = instances
        .map((i) => (isObj(i.config) ? i.config.context_length : null))
        .filter((n): n is number => typeof n === "number");
      const vision = isObj(m.capabilities) ? m.capabilities.vision : undefined;
      return {
        ids: [...str(m.key), ...instances.flatMap((i) => str(i.id))],
        vision: typeof vision === "boolean" ? vision : m.type === "embedding" ? false : null,
        contextLength: contexts.length ? Math.min(...contexts) : null,
      };
    });
  }
  if (Array.isArray(body.data)) {
    return body.data.filter(isObj).map((m) => ({
      ids: str(m.id),
      vision: m.type === "vlm" ? true : m.type === "llm" || m.type === "embeddings" ? false : null,
      contextLength: typeof m.loaded_context_length === "number" ? m.loaded_context_length : null,
    }));
  }
  return [];
}

export function findModel(models: readonly ModelCapabilities[], id: string) {
  return models.find((m) => m.ids.includes(id)) ?? null;
}
