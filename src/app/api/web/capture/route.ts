import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CAPTURE_DEVICES, CAPTURE_MODES, normalizeUrl } from "@/lib/web";
import { WebError } from "@/server/web/browser";
import { captureToLibrary } from "@/server/web/captures";

const inputSchema = z.object({
  url: z.string().max(2_000),
  device: z.enum(CAPTURE_DEVICES.map((d) => d.id) as ["desktop", "mobile"]).default("desktop"),
  mode: z.enum(CAPTURE_MODES.map((m) => m.id) as ["page", "element"]).default("page"),
  focusText: z.string().max(200).default(""),
  title: z.string().max(120).default(""),
});

/** Capture d'écran d'une page web, rangée dans la médiathèque. */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Demande invalide" }, { status: 400 });
  const url = normalizeUrl(parsed.data.url);
  if (!url) return Response.json({ error: "Adresse invalide (ex. tamarque.fr/tarifs)." }, { status: 400 });
  if (parsed.data.mode === "element" && !parsed.data.focusText.trim()) {
    return Response.json({ error: "Indique un texte du bloc à capturer." }, { status: 400 });
  }

  try {
    const capture = await captureToLibrary({ ...parsed.data, url, signal: request.signal });
    revalidatePath("/", "layout");
    return Response.json({ ok: true, capture });
  } catch (error) {
    if (error instanceof WebError) return Response.json({ error: error.message }, { status: 400 });
    if (request.signal.aborted) return new Response(null, { status: 499 });
    console.error("[capture]", error);
    return Response.json({ error: "La capture a échoué." }, { status: 500 });
  }
}
