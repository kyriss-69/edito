/**
 * Rôle d'une colonne du kanban : ce que l'app comprend du statut d'un post,
 * quel que soit le nom donné à la colonne.
 */
export const COLUMN_KINDS = [
  { id: "idea", label: "Idée", description: "Pas encore commencé" },
  { id: "progress", label: "En cours", description: "Rédaction, visuel, montage…" },
  { id: "review", label: "À valider", description: "Prêt, en attente de relecture" },
  { id: "scheduled", label: "Planifié", description: "Daté, prêt à partir" },
  { id: "published", label: "Publié", description: "En ligne" },
  { id: "archived", label: "Archivé", description: "Mis de côté" },
] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number]["id"];

export function isColumnKind(value: string): value is ColumnKind {
  return COLUMN_KINDS.some((k) => k.id === value);
}

export function columnKindOf(id: string) {
  return COLUMN_KINDS.find((k) => k.id === id) ?? COLUMN_KINDS[1];
}

/** Colonnes dont les posts sont terminés : pas de retard possible, repliées par défaut. */
export function isDoneKind(kind: string) {
  return kind === "published" || kind === "archived";
}

/** Rôle probable d'une colonne d'après son nom (colonnes créées avant l'ajout des rôles). */
export function guessColumnKind(name: string): ColumnKind {
  const n = name.toLowerCase();
  if (n.includes("idée") || n.includes("idee")) return "idea";
  if (n.includes("valid") || n.includes("relecture")) return "review";
  if (n.includes("planifi") || n.includes("programm")) return "scheduled";
  if (n.includes("publi") || n.includes("en ligne")) return "published";
  if (n.includes("archiv")) return "archived";
  return "progress";
}

/** Couleurs proposées pour les colonnes, piliers et campagnes. */
export const TAG_COLORS = ["#a855f7", "#3b82f6", "#06b6d4", "#22c55e", "#f59e0b", "#f97316", "#ec4899", "#94a3b8"];
