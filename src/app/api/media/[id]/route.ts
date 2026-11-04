import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { postMedia } from "@/db/schema";
import { mediaPath, serveFile } from "@/server/media-storage";

/** Sert un média, avec prise en charge des requêtes `Range` (lecture vidéo). */
export async function GET(request: Request, ctx: RouteContext<"/api/media/[id]">) {
  const id = Number((await ctx.params).id);
  const media = getDb().select().from(postMedia).where(eq(postMedia.id, id)).get();
  if (!media) return new Response("Introuvable", { status: 404 });

  return serveFile(request, mediaPath(media.fileName), media.mimeType);
}
