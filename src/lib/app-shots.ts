import { z } from "zod";

/**
 * Planche de captures d'une app web (la tienne, lancée en local) : pages entières
 * et blocs (cartes, encadrés) rangés dans la médiathèque, catégorie « app », que
 * l'assistant peut placer sur les slides du Studio. Se règle par espace dans
 * `workspaces.json` (`appShots`).
 */

export const APP_SHOTS_CATEGORY = "app";

const appShotSchema = z.object({
  /** Identifiant stable : une nouvelle capture remplace l'ancienne (les slides qui l'utilisent suivent). */
  key: z.string().regex(/^[\w-]+$/),
  /** Compte utilisé (clé de `accounts`), ou « public » sans connexion. */
  role: z.string().default("public"),
  device: z.enum(["desktop", "mobile"]).default("desktop"),
  /** Page de l'app. */
  path: z.string(),
  /** Puis ouvre le premier lien dont l'adresse commence par ce chemin (et contient `text`, si donné). */
  follow: z.object({ prefix: z.string(), text: z.string().optional() }).optional(),
  /** Bloc à capturer : la carte ou l'encadré qui contient ce texte. Sans texte : l'écran entier. */
  block: z.string().optional(),
  /** Adresse affichée dans le cadre du navigateur ou du téléphone. */
  displayUrl: z.string(),
  title: z.string(),
  /** Ce que montre la capture : sert à l'assistant pour choisir l'image d'une slide. */
  description: z.string().default(""),
});

export const appShotsConfigSchema = z.object({
  /** Nom affiché (« l'app Exemple »). */
  appName: z.string().default("l'app"),
  baseUrl: z.string().url(),
  /** Page de connexion (champs email et mot de passe) et adresse atteinte une fois connecté. */
  loginPath: z.string().default("/login"),
  loggedInUrl: z.string().default("/"),
  /** Ajouté aux notes de chaque capture (ex. « données de démonstration »). */
  notes: z.string().default(""),
  /** Comment lancer l'app, affiché si elle ne répond pas. */
  startHint: z.string().default(""),
  /** Comptes de test de l'app (jamais de vrais identifiants). */
  accounts: z.record(z.string(), z.object({ email: z.string(), password: z.string(), label: z.string() })).default({}),
  shots: z.array(appShotSchema).min(1),
});

export type AppShot = z.output<typeof appShotSchema>;
export type AppShotsConfig = z.output<typeof appShotsConfigSchema>;

/** Ce que voit le navigateur (sans les mots de passe). */
export type AppShotsInfo = {
  appName: string;
  baseUrl: string;
  accounts: { email: string; label: string }[];
  shots: { key: string; title: string }[];
};

/** Progression de la planche de captures (route /api/web/app-shots, NDJSON). */
export type AppShotsEvent =
  | { type: "start"; total: number }
  | { type: "shot"; index: number; key: string; title: string; ok: true; assetId: number }
  | { type: "shot"; index: number; key: string; title: string; ok: false; error: string }
  | { type: "done"; saved: number; failed: number }
  | { type: "error"; message: string };

/** Nom de fichier stable d'une capture (sert à retrouver l'ancienne pour la remplacer). */
export const appShotFileName = (key: string) => `app-${key}.png`;

/** Notes de la capture : adresse affichée (lue par le Studio) et description (lue par l'assistant). */
export function appShotNotes(shot: AppShot, note: string) {
  const where = shot.device === "mobile" ? "téléphone" : "ordinateur";
  return `Capture de https://${shot.displayUrl} (${where}${shot.block ? ", un bloc de la page" : ""})${note ? `, ${note}` : ""}.\n${shot.description}`;
}

/** Description d'une capture de l'app pour l'assistant (la 2e ligne des notes). */
export function appShotDescription(notes: string) {
  return notes.split("\n").slice(1).join(" ").trim();
}
