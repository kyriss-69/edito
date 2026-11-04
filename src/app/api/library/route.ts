import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { libraryAssets } from "@/db/schema";
import { ASSET_CATEGORIES, guessCategory, titleFromFileName } from "@/lib/library";
import { ACCEPTED_MIME, saveUpload } from "@/server/media-storage";

const CATEGORY_IDS: string[] = ASSET_CATEGORIES.map((c) => c.id);

/** Ajoute un ou plusieurs fichiers (champ `files`) à la médiathèque. */
export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const category = String(form.get("category") ?? "");
  if (!files.length || files.some((f) => !ACCEPTED_MIME.test(f.type))) {
    return Response.json({ error: "Seules les images et les vidéos sont acceptées." }, { status: 400 });
  }

  const db = getDb();
  const ids: number[] = [];
  for (const file of files) {
    const fileName = await saveUpload(file);
    const { id } = db
      .insert(libraryAssets)
      .values({
        fileName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        title: titleFromFileName(file.name),
        category: CATEGORY_IDS.includes(category) ? category : guessCategory(file.type),
      })
      .returning({ id: libraryAssets.id })
      .get();
    ids.push(id);
  }

  revalidatePath("/", "layout");
  return Response.json({ ok: true, count: files.length, ids });
}
