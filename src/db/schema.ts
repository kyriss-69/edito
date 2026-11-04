import { relations, sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

/** Colonnes du kanban (statuts d'un post). */
export const columns = sqliteTable("columns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  /** Rôle de la colonne (voir COLUMN_KINDS dans src/lib/columns.ts). */
  kind: text("kind").notNull().default("progress"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/** Piliers de contenu (éducatif, coulisses, promo…). */
export const pillars = sqliteTable("pillars", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/** Campagnes marketing (lancement, fonctionnalité, événement…). */
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#94a3b8"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  format: text("format").notNull().default("image"),
  columnId: integer("column_id")
    .notNull()
    .references(() => columns.id, { onDelete: "restrict" }),
  position: integer("position").notNull().default(0),
  scheduledAt: integer("scheduled_at", { mode: "timestamp_ms" }),
  priority: text("priority").notNull().default("medium"),
  pillarId: integer("pillar_id").references(() => pillars.id, {
    onDelete: "set null",
  }),
  campaignId: integer("campaign_id").references(() => campaigns.id, {
    onDelete: "set null",
  }),
  hashtags: text("hashtags").notNull().default(""),
  cta: text("cta").notNull().default(""),
  link: text("link").notNull().default(""),
  notes: text("notes").notNull().default(""),
  publishedUrl: text("published_url").notNull().default(""),
  /** Liberté de rédaction de l'assistant (`AiMode`). */
  aiMode: text("ai_mode").notNull().default("open"),
  /** Recherches web du post, JSON (`PostResearch`, `src/lib/ai/research.ts`) ou vide. */
  research: text("research").notNull().default(""),
  ...timestamps,
});

/** Réseaux ciblés par un post, avec une légende spécifique optionnelle. */
export const postPlatforms = sqliteTable(
  "post_platforms",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    customCaption: text("custom_caption"),
    customHashtags: text("custom_hashtags"),
  },
  (t) => [primaryKey({ columns: [t.postId, t.platform] })],
);

export const postMedia = sqliteTable("post_media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: timestamps.createdAt,
});

export const checklistItems = sqliteTable("checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const columnsRelations = relations(columns, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  column: one(columns, {
    fields: [posts.columnId],
    references: [columns.id],
  }),
  pillar: one(pillars, { fields: [posts.pillarId], references: [pillars.id] }),
  campaign: one(campaigns, {
    fields: [posts.campaignId],
    references: [campaigns.id],
  }),
  platforms: many(postPlatforms),
  media: many(postMedia),
  checklist: many(checklistItems),
}));

export const postPlatformsRelations = relations(postPlatforms, ({ one }) => ({
  post: one(posts, { fields: [postPlatforms.postId], references: [posts.id] }),
}));

export const postMediaRelations = relations(postMedia, ({ one }) => ({
  post: one(posts, { fields: [postMedia.postId], references: [posts.id] }),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  post: one(posts, {
    fields: [checklistItems.postId],
    references: [posts.id],
  }),
}));

/** Réglages de l'application (clé → valeur JSON). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamps.updatedAt,
});

/** Fiche d'un compte sur un réseau social (un seul par réseau). */
export const socialAccounts = sqliteTable("social_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull().unique(),
  status: text("status").notNull().default("todo"),
  handle: text("handle").notNull().default(""),
  profileUrl: text("profile_url").notNull().default(""),
  accountType: text("account_type").notNull().default("business"),
  bio: text("bio").notNull().default(""),
  bioLink: text("bio_link").notNull().default(""),
  followersGoal: integer("followers_goal"),
  postsPerWeek: integer("posts_per_week"),
  /** Réseau coché d'office sur les nouveaux posts. */
  defaultOnPosts: integer("default_on_posts", { mode: "boolean" }).notNull().default(false),
  notes: text("notes").notNull().default(""),
  avatarFileName: text("avatar_file_name"),
  avatarMimeType: text("avatar_mime_type"),
  ...timestamps,
});

export const accountChecklistItems = sqliteTable("account_checklist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => socialAccounts.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
});

export const socialAccountsRelations = relations(socialAccounts, ({ many }) => ({
  checklist: many(accountChecklistItems),
}));

export const accountChecklistItemsRelations = relations(accountChecklistItems, ({ one }) => ({
  account: one(socialAccounts, {
    fields: [accountChecklistItems.accountId],
    references: [socialAccounts.id],
  }),
}));

/** Médiathèque : logos, visuels de marque, captures, photos, vidéos réutilisables. */
export const libraryAssets = sqliteTable("library_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("other"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

/** Groupes de hashtags réutilisables. */
export const hashtagGroups = sqliteTable("hashtag_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  hashtags: text("hashtags").notNull().default(""),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/** Modèles de posts (structure de légende, format, checklist…). */
export const postTemplates = sqliteTable("post_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull().default(""),
  hashtags: text("hashtags").notNull().default(""),
  cta: text("cta").notNull().default(""),
  format: text("format").notNull().default("image"),
  /** Liste JSON des réseaux. */
  platforms: text("platforms").notNull().default("[]"),
  pillarId: integer("pillar_id").references(() => pillars.id, { onDelete: "set null" }),
  notes: text("notes").notNull().default(""),
  /** Liste JSON des étapes de checklist. */
  checklist: text("checklist").notNull().default("[]"),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

/** Studio carrousel : slides (titre + texte) posées sur un mockup PNG de la bibliothèque. */
export const carousels = sqliteTable("carousels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  /** Description du post, envoyée à l'IA pour rédiger les slides. */
  description: text("description").notNull().default(""),
  mockupAssetId: integer("mockup_asset_id").references(() => libraryAssets.id, {
    onDelete: "set null",
  }),
  /** Liste JSON des slides ({ title, body }). */
  slides: text("slides").notNull().default("[]"),
  /** Mise en page JSON (couleur, alignement, marges, tailles). */
  style: text("style").notNull().default("{}"),
  /** Post créé à partir du carrousel. */
  postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
  ...timestamps,
});

/** Discussions avec l'assistant (page « Assistant »). */
export const assistantChats = sqliteTable("assistant_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  /** Liste JSON des messages (voir ChatEntry dans src/lib/ai/chat.ts). */
  messages: text("messages").notNull().default("[]"),
  ...timestamps,
});
