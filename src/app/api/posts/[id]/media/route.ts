import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { postMedia, posts } from "@/db/schema";
import { ACCEPTED_MIME, saveUpload } from "@/server/media-storage";

/** Upload d'un ou plusieurs médias (champ `files`) sur un post. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/posts/[id]/media">,
) {
  const postId = Number((await ctx.params).id);
  const db = getDb();
  if (!db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).get()) {
    return Response.json({ error: "Post introuvable" }, { status: 404 });
  }

  const files = (await request.formData())
    .getAll("files")
    .filter((f): f is File => f instanceof File);
  const rejected = files.filter((f) => !ACCEPTED_MIME.test(f.type));
  if (!files.length || rejected.length) {
    return Response.json(
      { error: "Seules les images et les vidéos sont acceptées." },
      { status: 400 },
    );
  }

  const [{ value }] = db
    .select({ value: max(postMedia.position) })
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .all();
  let position = (value ?? -1) + 1;

  for (const file of files) {
    const fileName = await saveUpload(file);
    db.insert(postMedia)
      .values({
        postId,
        fileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        position: position++,
      })
      .run();
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
