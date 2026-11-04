import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { libraryAssets } from "@/db/schema";
import { mediaPath, serveFile } from "@/server/media-storage";

/** Sert un fichier de la médiathèque. `?download=1` force le téléchargement. */
export async function GET(request: Request, ctx: RouteContext<"/api/library/[id]">) {
  const id = Number((await ctx.params).id);
  const asset = getDb().select().from(libraryAssets).where(eq(libraryAssets.id, id)).get();
  if (!asset) return new Response("Introuvable", { status: 404 });

  const response = await serveFile(request, mediaPath(asset.fileName), asset.mimeType);
  if (new URL(request.url).searchParams.has("download")) {
    response.headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`,
    );
  }
  return response;
}
