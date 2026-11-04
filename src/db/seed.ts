import { count, eq } from "drizzle-orm";

import { DEFAULT_ACCOUNT_CHECKLIST, DEFAULT_ON_POSTS } from "@/lib/accounts";
import { parseAiSettings } from "@/lib/ai/settings";
import { PLATFORM_IDS } from "@/lib/platforms";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import type { Workspace } from "@/lib/workspaces";
import { workspaceBrandKit } from "@/server/workspace";

import type { DB } from "./index";
import {
  accountChecklistItems,
  columns,
  hashtagGroups,
  pillars,
  postTemplates,
  settings,
  socialAccounts,
} from "./schema";

export const DEFAULT_COLUMNS = [
  { name: "💡 Idées", color: "#a855f7", kind: "idea" },
  { name: "✍️ En rédaction", color: "#3b82f6", kind: "progress" },
  { name: "🎨 Visuel en cours", color: "#ec4899", kind: "progress" },
  { name: "✅ À valider", color: "#f59e0b", kind: "review" },
  { name: "📅 Planifié", color: "#06b6d4", kind: "scheduled" },
  { name: "🚀 Publié", color: "#22c55e", kind: "published" },
  { name: "🗄️ Archivé", color: "#94a3b8", kind: "archived" },
];

export const DEFAULT_PILLARS = [
  { name: "Éducatif", color: "#3b82f6" },
  { name: "Coulisses", color: "#f97316" },
  { name: "Promo", color: "#8b5cf6" },
  { name: "Communauté", color: "#22c55e" },
  { name: "Divertissement", color: "#ec4899" },
];

/** Crée les colonnes et piliers par défaut lors du tout premier lancement. */
export function seedDefaults(db: DB, workspace: Workspace) {
  const [{ value: columnCount }] = db
    .select({ value: count() })
    .from(columns)
    .all();
  if (columnCount > 0) return;

  db.transaction((tx) => {
    tx.insert(columns)
      .values(DEFAULT_COLUMNS.map((c, position) => ({ ...c, position })))
      .run();
    tx.insert(pillars)
      .values((workspace.pillars ?? DEFAULT_PILLARS).map((p, position) => ({ ...p, position })))
      .run();
  });
}

/** Crée la fiche de chaque réseau (avec sa checklist) si elle n'existe pas encore. */
export function ensureAccounts(db: DB) {
  const existing = new Set(
    db.select({ platform: socialAccounts.platform }).from(socialAccounts).all().map((a) => a.platform),
  );
  const missing = PLATFORM_IDS.filter((platform) => !existing.has(platform));
  if (!missing.length) return;

  db.transaction((tx) => {
    for (const platform of missing) {
      const { id } = tx
        .insert(socialAccounts)
        .values({ platform, defaultOnPosts: DEFAULT_ON_POSTS.includes(platform) })
        .returning({ id: socialAccounts.id })
        .get();
      tx.insert(accountChecklistItems)
        .values(
          DEFAULT_ACCOUNT_CHECKLIST[platform].map((label, position) => ({
            accountId: id,
            label,
            position,
          })),
        )
        .run();
    }
  });
}

/** Exécute une initialisation une seule fois (même si l'utilisateur supprime ensuite les éléments). */
function runOnce(db: DB, key: string, fn: () => void) {
  if (db.select().from(settings).where(eq(settings.key, key)).get()) return;
  fn();
  db.insert(settings).values({ key, value: "done" }).run();
}

export const DEFAULT_HASHTAG_GROUPS = [
  { name: "Marque", hashtags: "#tamarque" },
  { name: "Communauté", hashtags: "#createurdecontenu #communaute #coulisses" },
  { name: "Business", hashtags: "#petiteentreprise #entrepreneur #marketingdigital" },
];

/** Lit un réglage stocké en JSON (`undefined` s'il manque). */
export function readSetting(db: DB, key: string): unknown {
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

/**
 * Premier lancement d'un espace : sa charte, son brief de marque (`workspaces.json`)
 * et, pour un autre espace que le principal, la connexion à LM Studio de celui-ci.
 */
export function seedWorkspace(db: DB, workspace: Workspace, mainAi?: unknown) {
  runOnce(db, "seed:workspace", () => {
    const { baseUrl, model, temperature } = parseAiSettings(mainAi ?? {});
    const ai = parseAiSettings({
      baseUrl,
      model,
      temperature,
      brand: { name: workspace.name, ...workspace.brief },
      web: { siteUrl: "" },
    });
    db.insert(settings)
      .values([
        { key: "brand", value: JSON.stringify(workspaceBrandKit(workspace.id)) },
        { key: "ai", value: JSON.stringify(ai) },
      ])
      .onConflictDoNothing()
      .run();
  });
}

/** Contenu de départ de la bibliothèque : groupes de hashtags et modèles de posts. */
export function seedLibrary(db: DB, workspace: Workspace) {
  if (!workspace.starterLibrary) return;
  runOnce(db, "seed:hashtag-groups", () => {
    db.insert(hashtagGroups)
      .values(DEFAULT_HASHTAG_GROUPS.map((g, position) => ({ ...g, position })))
      .run();
  });

  runOnce(db, "seed:templates", () => {
    const pillarIds = new Map(
      db.select({ id: pillars.id, name: pillars.name }).from(pillars).all().map((p) => [p.name, p.id]),
    );
    db.insert(postTemplates)
      .values(
        DEFAULT_TEMPLATES.map(({ pillar, platforms, checklist, ...t }, position) => ({
          ...t,
          platforms: JSON.stringify(platforms),
          checklist: JSON.stringify(checklist),
          pillarId: pillar ? (pillarIds.get(pillar) ?? null) : null,
          position,
        })),
      )
      .run();
  });
}
