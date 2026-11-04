import "server-only";

import fs from "node:fs";
import path from "node:path";

import { count } from "drizzle-orm";

import { getDb } from "@/db";
import { libraryAssets, postMedia, posts } from "@/db/schema";
import { DATA_DIR, dbFilePath, UPLOADS_DIR } from "@/lib/paths";

import { getActiveWorkspace } from "./workspace";

function folderSize(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    const full = path.join(dir, entry.name);
    return total + (entry.isDirectory() ? folderSize(full) : fs.statSync(full).size);
  }, 0);
}

function fileSize(file: string): number {
  return fs.existsSync(file) ? fs.statSync(file).size : 0;
}

/** Emplacement et taille des données locales (base SQLite et médias). */
export function getDataInfo() {
  const db = getDb();
  const dbFile = dbFilePath(getActiveWorkspace().dbFile);
  const total = (table: typeof posts | typeof postMedia | typeof libraryAssets) =>
    db.select({ value: count() }).from(table).get()?.value ?? 0;
  return {
    dataDir: DATA_DIR,
    dbFile,
    uploadsDir: UPLOADS_DIR,
    // La base en mode WAL garde les dernières écritures dans un fichier à côté.
    dbSize: fileSize(dbFile) + fileSize(`${dbFile}-wal`),
    uploadsSize: folderSize(UPLOADS_DIR),
    posts: total(posts),
    media: total(postMedia),
    library: total(libraryAssets),
  };
}
