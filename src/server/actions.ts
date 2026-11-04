"use server";

import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db";
import {
  accountChecklistItems,
  assistantChats,
  campaigns,
  carousels,
  checklistItems,
  columns,
  hashtagGroups,
  libraryAssets,
  postTemplates,
  pillars,
  postMedia,
  postPlatforms,
  posts,
  socialAccounts,
} from "@/db/schema";
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, cleanHandle, defaultPostPlatforms } from "@/lib/accounts";
import { aiSettingsSchema, normalizeBaseUrl } from "@/lib/ai/settings";
import { postResearchSchema, serializeResearch } from "@/lib/ai/research";
import { siteNotesSchema } from "@/lib/ai/site";
import { brandKitSchema } from "@/lib/brand";
import {
  CAROUSEL_DESCRIPTION_MAX,
  carouselStyleSchema,
  defaultCarouselStyle,
  MAX_SLIDES,
  parseCarouselStyle,
  resizeSlides,
  slideSchema,
} from "@/lib/carousel";
import { isColumnKind } from "@/lib/columns";
import { ASSET_CATEGORIES } from "@/lib/library";
import { GENERATED_IDEA_MARK } from "@/lib/ai/tasks";
import { normalizeHashtags } from "@/lib/captions";
import {
  DEFAULT_CHECKLIST,
  FORMATS,
  isPlatformId,
  PLATFORM_IDS,
  PRIORITIES,
  type PlatformId,
} from "@/lib/platforms";
import { uiPreferencesSchema } from "@/lib/preferences";

import { copyUpload, removeUpload } from "./media-storage";
import { isWorkspaceId, setActiveWorkspace } from "./workspace";
import {
  getBrandKit,
  getSiteNotes,
  getUiPreferences,
  writeAiSettings,
  writeBrandKit,
  writeOpenRouterKey,
  writeSiteNotes,
  writeUiPreferences,
} from "./settings";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function refresh() {
  revalidatePath("/", "layout");
}

function nextPosition(columnId: number) {
  const [{ value }] = getDb()
    .select({ value: max(posts.position) })
    .from(posts)
    .where(eq(posts.columnId, columnId))
    .all();
  return (value ?? -1) + 1;
}

/* ------------------------------------------------------------------ */
/* Posts                                                              */
/* ------------------------------------------------------------------ */

const idSchema = z.number().int().positive();

const postInputSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1, "Le titre est obligatoire").max(200),
  caption: z.string().max(10_000),
  format: z.enum(FORMATS.map((f) => f.id) as [string, ...string[]]),
  columnId: idSchema,
  scheduledAt: z.number().int().nullable(),
  priority: z.enum(PRIORITIES.map((p) => p.id) as [string, ...string[]]),
  pillarId: idSchema.nullable(),
  campaignId: idSchema.nullable(),
  hashtags: z.string().max(5_000),
  cta: z.string().max(500),
  link: z.string().max(2_000),
  notes: z.string().max(20_000),
  publishedUrl: z.string().max(2_000),
  aiMode: z.enum(["open", "strict"]).default("open"),
  research: postResearchSchema.nullable().default(null),
  platforms: z.array(
    z.object({
      platform: z.enum(PLATFORM_IDS),
      customCaption: z.string().max(10_000).nullable(),
      customHashtags: z.string().max(5_000).nullable().default(null),
    }),
  ),
  checklist: z.array(
    z.object({ label: z.string().trim().min(1).max(300), done: z.boolean() }),
  ),
});

export type PostInput = z.input<typeof postInputSchema>;

export async function savePost(
  input: PostInput,
): Promise<ActionResult<{ id: number }>> {
  const parsed = postInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { id, platforms, checklist, scheduledAt, research, ...fields } = parsed.data;
  const db = getDb();

  const values = {
    ...fields,
    hashtags: normalizeHashtags(fields.hashtags),
    scheduledAt: scheduledAt === null ? null : new Date(scheduledAt),
    research: serializeResearch(research),
    updatedAt: new Date(),
  };

  const postId = db.transaction((tx) => {
    let postId: number;
    if (id) {
      const existing = tx.select().from(posts).where(eq(posts.id, id)).get();
      if (!existing) throw new Error("Post introuvable");
      const position =
        existing.columnId === values.columnId
          ? existing.position
          : nextPosition(values.columnId);
      tx.update(posts).set({ ...values, position }).where(eq(posts.id, id)).run();
      postId = id;
    } else {
      postId = tx
        .insert(posts)
        .values({ ...values, position: nextPosition(values.columnId) })
        .returning({ id: posts.id })
        .get().id;
    }

    tx.delete(postPlatforms).where(eq(postPlatforms.postId, postId)).run();
    if (platforms.length) {
      tx.insert(postPlatforms)
        .values(
          platforms.map((p) => ({
            postId,
            platform: p.platform,
            customCaption: p.customCaption?.trim() ? p.customCaption : null,
            customHashtags: p.customHashtags === null ? null : normalizeHashtags(p.customHashtags),
          })),
        )
        .run();
    }

    tx.delete(checklistItems).where(eq(checklistItems.postId, postId)).run();
    if (checklist.length) {
      tx.insert(checklistItems)
        .values(checklist.map((c, position) => ({ ...c, postId, position })))
        .run();
    }
    return postId;
  });

  refresh();
  return { ok: true, data: { id: postId } };
}

export async function deletePost(id: number): Promise<ActionResult> {
  const db = getDb();
  const media = db.select().from(postMedia).where(eq(postMedia.postId, id)).all();
  db.delete(posts).where(eq(posts.id, id)).run();
  media.forEach((m) => removeUpload(m.fileName));
  refresh();
  return { ok: true };
}

export async function duplicatePost(
  id: number,
): Promise<ActionResult<{ id: number }>> {
  const db = getDb();
  const source = db.query.posts
    .findFirst({
      where: eq(posts.id, id),
      with: { platforms: true, media: true, checklist: true },
    })
    .sync();
  if (!source) return { ok: false, error: "Post introuvable" };

  const newId = db.transaction((tx) => {
    const {
      id: _id,
      platforms,
      media,
      checklist,
      createdAt: _c,
      updatedAt: _u,
      ...fields
    } = source;
    const newId = tx
      .insert(posts)
      .values({
        ...fields,
        title: `${source.title} (copie)`,
        scheduledAt: null,
        publishedUrl: "",
        position: nextPosition(source.columnId),
      })
      .returning({ id: posts.id })
      .get().id;

    if (platforms.length) {
      tx.insert(postPlatforms)
        .values(platforms.map((p) => ({ ...p, postId: newId })))
        .run();
    }
    if (checklist.length) {
      tx.insert(checklistItems)
        .values(
          checklist.map(({ label, position }) => ({
            label,
            position,
            done: false,
            postId: newId,
          })),
        )
        .run();
    }
    for (const { id: _mid, createdAt: _mc, fileName, ...m } of media) {
      tx.insert(postMedia)
        .values({ ...m, postId: newId, fileName: copyUpload(fileName) })
        .run();
    }
    return newId;
  });

  refresh();
  return { ok: true, data: { id: newId } };
}

/** Enregistre l'ordre complet d'une colonne du kanban (après un glisser-déposer). */
export async function reorderColumn(
  columnId: number,
  orderedPostIds: number[],
): Promise<ActionResult> {
  const db = getDb();
  db.transaction((tx) => {
    orderedPostIds.forEach((postId, position) => {
      tx.update(posts)
        .set({ columnId, position, updatedAt: new Date() })
        .where(eq(posts.id, postId))
        .run();
    });
  });
  refresh();
  return { ok: true };
}

export async function reschedulePost(
  id: number,
  scheduledAt: number | null,
): Promise<ActionResult> {
  getDb()
    .update(posts)
    .set({
      scheduledAt: scheduledAt === null ? null : new Date(scheduledAt),
      updatedAt: new Date(),
    })
    .where(eq(posts.id, id))
    .run();
  refresh();
  return { ok: true };
}

/** Lien du post une fois publié (demandé en le déposant dans une colonne « Publié »). */
export async function setPublishedUrl(id: number, url: string): Promise<ActionResult> {
  const parsed = z.string().trim().max(2_000).safeParse(url);
  if (!parsed.success) return { ok: false, error: "Lien invalide" };
  getDb()
    .update(posts)
    .set({ publishedUrl: parsed.data, updatedAt: new Date() })
    .where(eq(posts.id, id))
    .run();
  refresh();
  return { ok: true };
}

export async function bulkMovePosts(
  ids: number[],
  columnId: number,
): Promise<ActionResult> {
  const db = getDb();
  db.transaction((tx) => {
    let position = nextPosition(columnId);
    const rows = tx
      .select()
      .from(posts)
      .where(inArray(posts.id, ids))
      .orderBy(asc(posts.position))
      .all();
    for (const row of rows) {
      if (row.columnId === columnId) continue;
      tx.update(posts)
        .set({ columnId, position: position++, updatedAt: new Date() })
        .where(eq(posts.id, row.id))
        .run();
    }
  });
  refresh();
  return { ok: true };
}

export async function bulkDeletePosts(ids: number[]): Promise<ActionResult> {
  for (const id of ids) await deletePost(id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Médias                                                             */
/* ------------------------------------------------------------------ */

export async function deleteMedia(id: number): Promise<ActionResult> {
  const db = getDb();
  const media = db.select().from(postMedia).where(eq(postMedia.id, id)).get();
  if (!media) return { ok: false, error: "Média introuvable" };
  db.delete(postMedia).where(eq(postMedia.id, id)).run();
  removeUpload(media.fileName);
  refresh();
  return { ok: true };
}

export async function reorderMedia(
  postId: number,
  orderedIds: number[],
): Promise<ActionResult> {
  const db = getDb();
  db.transaction((tx) => {
    orderedIds.forEach((id, position) => {
      tx.update(postMedia)
        .set({ position })
        .where(and(eq(postMedia.id, id), eq(postMedia.postId, postId)))
        .run();
    });
  });
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Réglages : colonnes, piliers, campagnes                            */
/* ------------------------------------------------------------------ */

const TABLES = { columns, pillars, campaigns } as const;
export type SettingsKind = keyof typeof TABLES;

const tagSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(80),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Couleur invalide"),
});

export async function createTag(
  kind: SettingsKind,
  input: z.input<typeof tagSchema>,
): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const table = TABLES[kind];
  const db = getDb();
  const [{ value }] = db.select({ value: max(table.position) }).from(table).all();
  db.insert(table)
    .values({ ...parsed.data, position: (value ?? -1) + 1 })
    .run();
  refresh();
  return { ok: true };
}

export async function updateTag(
  kind: SettingsKind,
  id: number,
  input: z.input<typeof tagSchema>,
): Promise<ActionResult> {
  const parsed = tagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const table = TABLES[kind];
  getDb()
    .update(table)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(table.id, id))
    .run();
  refresh();
  return { ok: true };
}

export async function reorderTags(
  kind: SettingsKind,
  orderedIds: number[],
): Promise<ActionResult> {
  const table = TABLES[kind];
  const db = getDb();
  db.transaction((tx) => {
    orderedIds.forEach((id, position) => {
      tx.update(table).set({ position }).where(eq(table.id, id)).run();
    });
  });
  refresh();
  return { ok: true };
}

export async function setColumnKind(id: number, kind: string): Promise<ActionResult> {
  if (!isColumnKind(kind)) return { ok: false, error: "Rôle de colonne inconnu" };
  getDb().update(columns).set({ kind, updatedAt: new Date() }).where(eq(columns.id, id)).run();
  refresh();
  return { ok: true };
}

export async function deleteTag(
  kind: SettingsKind,
  id: number,
): Promise<ActionResult> {
  const db = getDb();
  if (kind === "columns") {
    const used = db.select({ id: posts.id }).from(posts).where(eq(posts.columnId, id)).get();
    if (used) {
      return {
        ok: false,
        error: "Cette colonne contient encore des posts : déplace-les avant de la supprimer.",
      };
    }
    const remaining = db.select({ id: columns.id }).from(columns).all();
    if (remaining.length <= 1) {
      return { ok: false, error: "Il faut garder au moins une colonne." };
    }
  }
  const table = TABLES[kind];
  db.delete(table).where(eq(table.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Assistant IA                                                       */
/* ------------------------------------------------------------------ */

export async function saveUiPreferences(
  input: Partial<z.input<typeof uiPreferencesSchema>>,
): Promise<ActionResult> {
  const parsed = uiPreferencesSchema.safeParse({ ...getUiPreferences(), ...input });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  writeUiPreferences(parsed.data);
  refresh();
  return { ok: true };
}

/** Enregistre (ou efface, avec une chaîne vide) la clé d'API OpenRouter. */
export async function saveOpenRouterKey(key: string): Promise<ActionResult> {
  const value = key.trim();
  if (value.length > 300 || /\s/.test(value)) return { ok: false, error: "Clé d'API invalide" };
  writeOpenRouterKey(value);
  refresh();
  return { ok: true };
}

export async function saveAiSettings(
  input: z.input<typeof aiSettingsSchema>,
): Promise<ActionResult> {
  const parsed = aiSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  writeAiSettings({ ...parsed.data, baseUrl: normalizeBaseUrl(parsed.data.baseUrl) });
  refresh();
  return { ok: true };
}

const ideaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().max(1_000),
  angle: z.string().max(2_000),
  format: z.enum(FORMATS.map((f) => f.id) as [string, ...string[]]),
});

/** Crée des posts dans la première colonne à partir des idées retenues. */
export async function createPostsFromIdeas(input: {
  ideas: z.input<typeof ideaSchema>[];
  pillarId: number | null;
  platforms: string[];
}): Promise<ActionResult<{ count: number }>> {
  const ideas = z.array(ideaSchema).min(1).max(20).safeParse(input.ideas);
  const platforms = z.array(z.enum(PLATFORM_IDS)).safeParse(input.platforms);
  if (!ideas.success || !platforms.success) return { ok: false, error: "Idées invalides" };

  const db = getDb();
  const firstColumn = db.select().from(columns).orderBy(asc(columns.position)).get();
  if (!firstColumn) return { ok: false, error: "Aucune colonne dans le tableau" };
  const pillarId =
    input.pillarId !== null &&
    db.select({ id: pillars.id }).from(pillars).where(eq(pillars.id, input.pillarId)).get()
      ? input.pillarId
      : null;

  db.transaction((tx) => {
    let position = nextPosition(firstColumn.id);
    for (const idea of ideas.data) {
      const notes = [
        idea.hook && `Accroche : ${idea.hook}`,
        idea.angle && `Angle : ${idea.angle}`,
        GENERATED_IDEA_MARK,
      ]
        .filter(Boolean)
        .join("\n\n");
      const postId = tx
        .insert(posts)
        .values({
          title: idea.title,
          format: idea.format,
          columnId: firstColumn.id,
          position: position++,
          pillarId,
          notes,
        })
        .returning({ id: posts.id })
        .get().id;
      if (platforms.data.length) {
        tx.insert(postPlatforms)
          .values(platforms.data.map((platform) => ({ postId, platform })))
          .run();
      }
      tx.insert(checklistItems)
        .values(DEFAULT_CHECKLIST.map((label, i) => ({ postId, label, position: i })))
        .run();
    }
  });

  refresh();
  return { ok: true, data: { count: ideas.data.length } };
}

/* ------------------------------------------------------------------ */
/* Comptes réseaux sociaux                                            */
/* ------------------------------------------------------------------ */

const optionalCount = z.number().int().min(0).max(100_000_000).nullable();

const accountInputSchema = z.object({
  id: idSchema,
  status: z.enum(ACCOUNT_STATUSES.map((s) => s.id) as [string, ...string[]]),
  handle: z.string().max(100),
  profileUrl: z.string().max(500),
  accountType: z.enum(ACCOUNT_TYPES.map((t) => t.id) as [string, ...string[]]),
  bio: z.string().max(1_000),
  bioLink: z.string().max(500),
  followersGoal: optionalCount,
  postsPerWeek: z.number().int().min(0).max(50).nullable(),
  defaultOnPosts: z.boolean(),
  notes: z.string().max(20_000),
  checklist: z.array(
    z.object({ label: z.string().trim().min(1).max(300), done: z.boolean() }),
  ),
});

export async function saveAccount(
  input: z.input<typeof accountInputSchema>,
): Promise<ActionResult> {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  const { id, checklist, ...fields } = parsed.data;
  const db = getDb();
  if (!db.select({ id: socialAccounts.id }).from(socialAccounts).where(eq(socialAccounts.id, id)).get()) {
    return { ok: false, error: "Compte introuvable" };
  }

  db.transaction((tx) => {
    tx.update(socialAccounts)
      .set({ ...fields, handle: cleanHandle(fields.handle), updatedAt: new Date() })
      .where(eq(socialAccounts.id, id))
      .run();
    tx.delete(accountChecklistItems).where(eq(accountChecklistItems.accountId, id)).run();
    if (checklist.length) {
      tx.insert(accountChecklistItems)
        .values(checklist.map((c, position) => ({ ...c, accountId: id, position })))
        .run();
    }
  });

  refresh();
  return { ok: true };
}

export async function removeAccountAvatar(id: number): Promise<ActionResult> {
  const db = getDb();
  const account = db.select().from(socialAccounts).where(eq(socialAccounts.id, id)).get();
  if (!account) return { ok: false, error: "Compte introuvable" };
  db.update(socialAccounts)
    .set({ avatarFileName: null, avatarMimeType: null, updatedAt: new Date() })
    .where(eq(socialAccounts.id, id))
    .run();
  if (account.avatarFileName) removeUpload(account.avatarFileName);
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Bibliothèque : charte, médias, hashtags, modèles                   */
/* ------------------------------------------------------------------ */

/** Ouvre un autre espace de travail (une base par marque). */
export async function switchWorkspace(id: string): Promise<ActionResult> {
  if (!isWorkspaceId(id)) return { ok: false, error: "Espace de travail inconnu" };
  setActiveWorkspace(id);
  getDb(); // Crée (et prépare) la base au premier passage.
  refresh();
  return { ok: true };
}

export async function saveBrandKit(
  input: z.input<typeof brandKitSchema>,
): Promise<ActionResult> {
  const parsed = brandKitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  writeBrandKit(parsed.data);
  refresh();
  return { ok: true };
}

const assetSchema = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(200),
  category: z.enum(ASSET_CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  notes: z.string().max(5_000),
});

export async function updateAsset(
  id: number,
  input: z.input<typeof assetSchema>,
): Promise<ActionResult> {
  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  getDb()
    .update(libraryAssets)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(libraryAssets.id, id))
    .run();
  refresh();
  return { ok: true };
}

export async function deleteAsset(id: number): Promise<ActionResult> {
  const db = getDb();
  const asset = db.select().from(libraryAssets).where(eq(libraryAssets.id, id)).get();
  if (!asset) return { ok: false, error: "Média introuvable" };
  db.delete(libraryAssets).where(eq(libraryAssets.id, id)).run();
  removeUpload(asset.fileName);
  refresh();
  return { ok: true };
}

/** Ajoute des médias de la bibliothèque à un post (chaque fichier est copié). */
export async function addLibraryAssetsToPost(
  postId: number,
  assetIds: number[],
): Promise<ActionResult<{ count: number }>> {
  const db = getDb();
  if (!db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)).get()) {
    return { ok: false, error: "Post introuvable" };
  }
  const assets = db.select().from(libraryAssets).where(inArray(libraryAssets.id, assetIds)).all();
  const [{ value }] = db
    .select({ value: max(postMedia.position) })
    .from(postMedia)
    .where(eq(postMedia.postId, postId))
    .all();
  let position = (value ?? -1) + 1;
  // Respecte l'ordre de sélection.
  const ordered = assetIds
    .map((id) => assets.find((a) => a.id === id))
    .filter((a): a is (typeof assets)[number] => a !== undefined);
  for (const asset of ordered) {
    db.insert(postMedia)
      .values({
        postId,
        fileName: copyUpload(asset.fileName),
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        size: asset.size,
        position: position++,
      })
      .run();
  }
  refresh();
  return { ok: true, data: { count: ordered.length } };
}

const hashtagGroupSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire").max(80),
  hashtags: z.string().max(5_000),
});

export async function saveHashtagGroup(
  id: number | null,
  input: z.input<typeof hashtagGroupSchema>,
): Promise<ActionResult> {
  const parsed = hashtagGroupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const values = { ...parsed.data, hashtags: normalizeHashtags(parsed.data.hashtags) };
  const db = getDb();
  if (id === null) {
    const [{ value }] = db.select({ value: max(hashtagGroups.position) }).from(hashtagGroups).all();
    db.insert(hashtagGroups).values({ ...values, position: (value ?? -1) + 1 }).run();
  } else {
    db.update(hashtagGroups)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(hashtagGroups.id, id))
      .run();
  }
  refresh();
  return { ok: true };
}

export async function deleteHashtagGroup(id: number): Promise<ActionResult> {
  getDb().delete(hashtagGroups).where(eq(hashtagGroups.id, id)).run();
  refresh();
  return { ok: true };
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "Le nom du modèle est obligatoire").max(120),
  description: z.string().max(500),
  title: z.string().max(200),
  caption: z.string().max(10_000),
  hashtags: z.string().max(5_000),
  cta: z.string().max(500),
  format: z.enum(FORMATS.map((f) => f.id) as [string, ...string[]]),
  platforms: z.array(z.enum(PLATFORM_IDS)),
  pillarId: idSchema.nullable(),
  notes: z.string().max(20_000),
  checklist: z.array(z.string().trim().min(1).max(300)).max(50),
});

export type TemplateInput = z.input<typeof templateSchema>;

export async function saveTemplate(
  id: number | null,
  input: TemplateInput,
): Promise<ActionResult<{ id: number }>> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { platforms, checklist, ...fields } = parsed.data;
  const values = {
    ...fields,
    hashtags: normalizeHashtags(fields.hashtags),
    platforms: JSON.stringify(platforms),
    checklist: JSON.stringify(checklist),
  };
  const db = getDb();
  let templateId: number;
  if (id === null) {
    const [{ value }] = db.select({ value: max(postTemplates.position) }).from(postTemplates).all();
    templateId = db
      .insert(postTemplates)
      .values({ ...values, position: (value ?? -1) + 1 })
      .returning({ id: postTemplates.id })
      .get().id;
  } else {
    db.update(postTemplates)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(postTemplates.id, id))
      .run();
    templateId = id;
  }
  refresh();
  return { ok: true, data: { id: templateId } };
}

export async function deleteTemplate(id: number): Promise<ActionResult> {
  getDb().delete(postTemplates).where(eq(postTemplates.id, id)).run();
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Studio carrousel                                                   */
/* ------------------------------------------------------------------ */

const carouselFields = {
  title: z.string().trim().min(1, "Donne un titre au carrousel.").max(200),
  description: z
    .string()
    .trim()
    .min(1, "Décris le post : l'IA s'en sert pour rédiger des slides précises.")
    .max(CAROUSEL_DESCRIPTION_MAX, "Description : 5 000 caractères maximum."),
  mockupAssetId: idSchema.nullable(),
};

/** Garde le mockup seulement s'il existe et que c'est une image. */
function existingMockup(id: number | null): number | null {
  if (id === null) return null;
  const asset = getDb()
    .select({ mimeType: libraryAssets.mimeType })
    .from(libraryAssets)
    .where(eq(libraryAssets.id, id))
    .get();
  return asset?.mimeType.startsWith("image/") ? id : null;
}

export async function createCarousel(input: {
  title: string;
  description: string;
  slideCount: number;
  mockupAssetId: number | null;
  /** Mise en page adaptée au mockup (zone libre détectée dans le navigateur). */
  style?: z.input<typeof carouselStyleSchema>;
  /** Post existant dont le carrousel fournira les images (créé depuis sa fiche). */
  postId?: number | null;
}): Promise<ActionResult<{ id: number }>> {
  const parsed = z
    .object({
      ...carouselFields,
      slideCount: z.number().int().min(1).max(MAX_SLIDES),
      style: carouselStyleSchema.optional(),
      postId: idSchema.nullable().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { title, description, slideCount } = parsed.data;
  const db = getDb();
  const mockupAssetId = existingMockup(parsed.data.mockupAssetId);
  // Même mockup qu'un carrousel précédent : on reprend sa mise en page (réglages déjà ajustés).
  const previous =
    mockupAssetId === null
      ? undefined
      : db
          .select({ style: carousels.style })
          .from(carousels)
          .where(eq(carousels.mockupAssetId, mockupAssetId))
          .orderBy(desc(carousels.updatedAt))
          .get();
  const style = previous
    ? parseCarouselStyle(JSON.parse(previous.style))
    : (parsed.data.style ?? defaultCarouselStyle(getBrandKit()));
  const postId = parsed.data.postId
    ? (db.select({ id: posts.id }).from(posts).where(eq(posts.id, parsed.data.postId)).get()?.id ?? null)
    : null;
  const id = db
    .insert(carousels)
    .values({
      title,
      description,
      mockupAssetId,
      postId,
      slides: JSON.stringify(resizeSlides([], slideCount)),
      style: JSON.stringify(style),
    })
    .returning({ id: carousels.id })
    .get().id;
  refresh();
  return { ok: true, data: { id } };
}

export async function saveCarousel(input: {
  id: number;
  title: string;
  description: string;
  mockupAssetId: number | null;
  slides: z.input<typeof slideSchema>[];
  style: z.input<typeof carouselStyleSchema>;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      ...carouselFields,
      id: idSchema,
      slides: z.array(slideSchema).min(1).max(MAX_SLIDES, `${MAX_SLIDES} slides maximum.`),
      style: carouselStyleSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, title, description, mockupAssetId, slides, style } = parsed.data;
  const result = getDb()
    .update(carousels)
    .set({
      title,
      description,
      mockupAssetId: existingMockup(mockupAssetId),
      slides: JSON.stringify(slides),
      style: JSON.stringify(style),
      updatedAt: new Date(),
    })
    .where(eq(carousels.id, id))
    .run();
  if (!result.changes) return { ok: false, error: "Carrousel introuvable" };
  refresh();
  return { ok: true };
}

export async function deleteCarousel(id: number): Promise<ActionResult> {
  getDb().delete(carousels).where(eq(carousels.id, id)).run();
  refresh();
  return { ok: true };
}

/**
 * Avant l'export des slides : renvoie le post du carrousel (créé au besoin, au
 * format carrousel) et ses médias actuels, que les nouvelles images remplacent.
 */
export async function prepareCarouselPost(
  id: number,
): Promise<ActionResult<{ postId: number; previousMediaIds: number[]; created: boolean }>> {
  const db = getDb();
  const carousel = db.select().from(carousels).where(eq(carousels.id, id)).get();
  if (!carousel) return { ok: false, error: "Carrousel introuvable" };

  if (carousel.postId !== null) {
    const post = db.select({ id: posts.id }).from(posts).where(eq(posts.id, carousel.postId)).get();
    if (post) {
      const previousMediaIds = db
        .select({ id: postMedia.id })
        .from(postMedia)
        .where(eq(postMedia.postId, post.id))
        .all()
        .map((m) => m.id);
      return { ok: true, data: { postId: post.id, previousMediaIds, created: false } };
    }
  }

  const firstColumn = db.select().from(columns).orderBy(asc(columns.position)).get();
  if (!firstColumn) return { ok: false, error: "Aucune colonne dans le tableau" };
  const postId = db.transaction((tx) => {
    const newId = tx
      .insert(posts)
      .values({
        title: carousel.title,
        format: "carousel",
        columnId: firstColumn.id,
        position: nextPosition(firstColumn.id),
        notes: `Carrousel créé dans le Studio.\n\n${carousel.description}`,
      })
      .returning({ id: posts.id })
      .get().id;
    const accounts = tx
      .select({
        platform: socialAccounts.platform,
        status: socialAccounts.status,
        defaultOnPosts: socialAccounts.defaultOnPosts,
      })
      .from(socialAccounts)
      .all()
      .filter((a): a is typeof a & { platform: PlatformId } => isPlatformId(a.platform));
    const platforms = defaultPostPlatforms(accounts);
    if (platforms.length) {
      tx.insert(postPlatforms)
        .values(platforms.map((platform) => ({ postId: newId, platform })))
        .run();
    }
    tx.insert(checklistItems)
      .values(DEFAULT_CHECKLIST.map((label, i) => ({ postId: newId, label, position: i })))
      .run();
    tx.update(carousels).set({ postId: newId }).where(eq(carousels.id, id)).run();
    return newId;
  });
  refresh();
  return { ok: true, data: { postId, previousMediaIds: [], created: true } };
}

/** Retire des médias d'un post (anciennes images d'un carrousel réexporté). */
export async function removePostMedia(postId: number, ids: number[]): Promise<ActionResult> {
  if (!ids.length) return { ok: true };
  const db = getDb();
  const where = and(eq(postMedia.postId, postId), inArray(postMedia.id, ids));
  const media = db.select().from(postMedia).where(where).all();
  db.delete(postMedia).where(where).run();
  media.forEach((m) => removeUpload(m.fileName));
  refresh();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Assistant : analyse du site et discussions                         */
/* ------------------------------------------------------------------ */

/** Modifie le résumé du site envoyé à l'assistant (ou l'efface avec un texte vide). */
export async function saveSiteSummary(summary: string): Promise<ActionResult> {
  const parsed = siteNotesSchema.shape.summary.safeParse(summary.trim());
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const current = getSiteNotes();
  writeSiteNotes(parsed.data ? { ...current, summary: parsed.data } : { ...current, summary: "", pages: [], analyzedAt: null });
  refresh();
  return { ok: true };
}

export async function renameChat(id: number, title: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1, "Titre vide").max(120).safeParse(title);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  getDb().update(assistantChats).set({ title: parsed.data }).where(eq(assistantChats.id, id)).run();
  revalidatePath("/assistant");
  return { ok: true };
}

export async function deleteChat(id: number): Promise<ActionResult> {
  getDb().delete(assistantChats).where(eq(assistantChats.id, id)).run();
  revalidatePath("/assistant");
  return { ok: true };
}
