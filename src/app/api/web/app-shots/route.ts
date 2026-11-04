import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ndjsonResponse } from "@/server/ai/run-task";
import type { AppShotsEvent } from "@/lib/app-shots";
import { captureAppShots } from "@/server/web/app-shots";

const inputSchema = z.object({ keys: z.array(z.string().max(80)).max(100).default([]) });

/** Planche de captures de l'app : progression capture par capture (NDJSON). */
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Demande invalide" }, { status: 400 });
  return ndjsonResponse<AppShotsEvent>(async (send) => {
    try {
      await captureAppShots(send, { keys: parsed.data.keys, signal: request.signal });
    } catch (error) {
      console.error("[app-shots]", error);
      send({ type: "error", message: error instanceof Error ? error.message : "Les captures ont échoué." });
    } finally {
      revalidatePath("/", "layout");
    }
  });
}
