import { normalizeBaseUrl } from "@/lib/ai/settings";
import { AiError, listModelCapabilities, listModels, listOpenRouterModels } from "@/server/ai/lmstudio";

/** Teste la connexion à LM Studio et liste les modèles disponibles (et ceux qui lisent les images). */
export async function GET(request: Request) {
  const baseUrl = new URL(request.url).searchParams.get("baseUrl") ?? "";
  if (!/^https?:\/\/[^/]+/.test(normalizeBaseUrl(baseUrl))) {
    return Response.json({ error: "Adresse invalide (ex. http://localhost:1234)" }, { status: 400 });
  }
  try {
    const signal = AbortSignal.timeout(5_000);
    const models = await listModels(baseUrl, signal);
    const capabilities = await listModelCapabilities(baseUrl, signal);
    // Modèles qui lisent les images (pour l'analyse des médias d'un post).
    const vision = models.filter((id) => capabilities.some((m) => m.vision && m.ids.includes(id)));
    return Response.json({ models, vision });
  } catch (error) {
    const message =
      error instanceof AiError
        ? error.message
        : "Impossible de joindre LM Studio à cette adresse.";
    return Response.json({ error: message }, { status: 502 });
  }
}

/**
 * Teste une clé OpenRouter (celle saisie, sinon celle enregistrée) et liste les modèles qui savent
 * appeler des outils, les gratuits (« :free ») d'abord. En POST : la clé ne passe jamais dans l'adresse.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { key?: unknown };
  const key = typeof body.key === "string" && body.key.trim() ? body.key.trim() : undefined;
  try {
    const { models, capabilities } = await listOpenRouterModels(AbortSignal.timeout(10_000), key);
    const vision = capabilities.filter((m) => m.vision).flatMap((m) => m.ids);
    return Response.json({ models, vision });
  } catch (error) {
    const message = error instanceof AiError ? error.message : "Impossible de joindre OpenRouter.";
    return Response.json({ error: message }, { status: 502 });
  }
}
