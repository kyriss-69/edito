import fs from "node:fs";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { socialAccounts } from "@/db/schema";
import { mediaCacheHeaders, mediaPath, notModified, removeUpload, saveUpload } from "@/server/media-storage";

async function findAccount(ctx: RouteContext<"/api/accounts/[id]/avatar">) {
  const id = Number((await ctx.params).id);
  return getDb().select().from(socialAccounts).where(eq(socialAccounts.id, id)).get();
}

/** Photo de profil du compte. */
export async function GET(request: Request, ctx: RouteContext<"/api/accounts/[id]/avatar">) {
  const account = await findAccount(ctx);
  if (!account?.avatarFileName) return new Response("Introuvable", { status: 404 });
  const cached = notModified(request, account.avatarFileName);
  if (cached) return cached;
  try {
    const data = await fs.promises.readFile(mediaPath(account.avatarFileName));
    return new Response(data, {
      headers: {
        "Content-Type": account.avatarMimeType ?? "application/octet-stream",
        ...mediaCacheHeaders(account.avatarFileName),
      },
    });
  } catch {
    return new Response("Fichier manquant", { status: 404 });
  }
}

/** Remplace la photo de profil (champ `file`). */
export async function POST(request: Request, ctx: RouteContext<"/api/accounts/[id]/avatar">) {
  const account = await findAccount(ctx);
  if (!account) return Response.json({ error: "Compte introuvable" }, { status: 404 });

  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "Choisis une image." }, { status: 400 });
  }

  const fileName = await saveUpload(file);
  getDb()
    .update(socialAccounts)
    .set({ avatarFileName: fileName, avatarMimeType: file.type, updatedAt: new Date() })
    .where(eq(socialAccounts.id, account.id))
    .run();
  if (account.avatarFileName) removeUpload(account.avatarFileName);

  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}
