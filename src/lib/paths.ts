import path from "node:path";

/** Dossier des données locales (bases SQLite des espaces + médias). Ignoré par git. */
export const DATA_DIR =
  process.env.EDITO_DATA_DIR ?? path.join(process.cwd(), "data");
/** Base d'un espace de travail (`marque.db`…). */
export const dbFilePath = (fileName: string) => path.join(/*turbopackIgnore: true*/ DATA_DIR, fileName);
/** Espace de travail ouvert (partagé par toutes les fenêtres). */
export const WORKSPACE_FILE = path.join(DATA_DIR, "workspace.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
