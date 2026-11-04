import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { DATA_DIR, dbFilePath, UPLOADS_DIR } from "@/lib/paths";
import type { Workspace, WorkspaceId } from "@/lib/workspaces";
import { getActiveWorkspace, getWorkspace, mainWorkspace } from "@/server/workspace";

import * as schema from "./schema";
import { ensureAccounts, readSetting, seedDefaults, seedLibrary, seedWorkspace } from "./seed";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { editoDbs?: Map<WorkspaceId, DB> };

function createDb(workspace: Workspace): DB {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const sqlite = new Database(dbFilePath(workspace.dbFile));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seedDefaults(db, workspace);
  ensureAccounts(db);
  seedLibrary(db, workspace);
  // Autre espace que le principal : même connexion à LM Studio.
  const main = mainWorkspace();
  seedWorkspace(db, workspace, main.id === workspace.id ? undefined : readSetting(getDbFor(main.id), "ai"));
  return db;
}

/** Connexion à la base d'un espace, créée (et migrée) au premier accès. */
export function getDbFor(id: WorkspaceId): DB {
  globalForDb.editoDbs ??= new Map();
  let db = globalForDb.editoDbs.get(id);
  if (!db) {
    db = createDb(getWorkspace(id));
    globalForDb.editoDbs.set(id, db);
  }
  return db;
}

/** Base de l'espace de travail ouvert. */
export function getDb(): DB {
  return getDbFor(getActiveWorkspace().id);
}
