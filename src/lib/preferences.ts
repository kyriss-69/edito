import { z } from "zod";

export const THEMES = [
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
  { id: "system", label: "Système" },
] as const;
export type Theme = (typeof THEMES)[number]["id"];

/** Cookie qui garde le thème choisi (lu par le layout racine pour éviter un flash au chargement). */
export const THEME_COOKIE = "theme";

export function parseTheme(value: string | undefined): Theme {
  return THEMES.some((t) => t.id === value) ? (value as Theme) : "system";
}

/** Cookie qui garde la barre latérale repliée (« collapsed ») ou dépliée. */
export const SIDEBAR_COOKIE = "sidebar";

export const BOARD_DENSITIES = [
  { id: "compact", label: "Compacte", description: "Vignette et infos essentielles" },
  { id: "detailed", label: "Détaillée", description: "Avec le début de la légende" },
  { id: "cover", label: "Couverture", description: "Grande image du premier média" },
] as const;
export type BoardDensity = (typeof BOARD_DENSITIES)[number]["id"];

export const LANDING_PAGES = [
  { id: "board", label: "Tableau", href: "/board" },
  { id: "home", label: "Accueil", href: "/home" },
] as const;

/** Préférences d'affichage (clé `ui` de la table `settings`). */
export const uiPreferencesSchema = z.object({
  boardDensity: z.enum(["compact", "detailed", "cover"]).default("compact"),
  /** Colonnes repliées ; null = réglage par défaut (colonnes « Publié » et « Archivé »). */
  collapsedColumns: z.array(z.number().int()).nullable().default(null),
  /** Page ouverte au lancement de l'app. */
  landing: z.enum(["board", "home"]).default("board"),
  /** Carte « Bien démarrer » masquée sur l'Accueil. */
  onboardingDismissed: z.boolean().default(false),
});
export type UiPreferences = z.infer<typeof uiPreferencesSchema>;

export function parseUiPreferences(raw: unknown): UiPreferences {
  const result = uiPreferencesSchema.safeParse(raw ?? {});
  return result.success ? result.data : uiPreferencesSchema.parse({});
}
