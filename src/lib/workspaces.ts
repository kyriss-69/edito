import { z } from "zod";

import { appShotsConfigSchema } from "@/lib/app-shots";
import { brandKitSchema } from "@/lib/brand";

/**
 * Espaces de travail : une marque = une base SQLite dans `data/` (posts,
 * charte, comptes, Studio séparés) et son document de référence dans `brand/`.
 * Les médias partagent le dossier `data/uploads` (noms uniques).
 *
 * La liste vient de `workspaces.json` à la racine du projet (ignoré par git,
 * modèle dans `workspaces.example.json`) ; sans ce fichier, un seul espace
 * « Ma marque ». Lue au démarrage : redémarrer l'app après une modification.
 */
const workspaceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, "Identifiant : minuscules, chiffres et tirets"),
    name: z.string().trim().min(1).max(60),
    /** Base dans `data/` (défaut : `<id>.db`). */
    dbFile: z.string().regex(/^[\w.-]+\.db$/).optional(),
    /** Document de référence dans `brand/` (défaut : `<ID>.md`). */
    brandDoc: z.string().regex(/^[\w.-]+\.md$/).optional(),
    /** Groupes de hashtags et modèles de posts de départ. */
    starterLibrary: z.boolean().default(true),
    /** Captures de ton app web pour le Studio (voir `src/lib/app-shots.ts`). */
    appShots: appShotsConfigSchema.optional(),
    /** Guides relus à chaque demande (leçons, règles de vérification…), chemins absolus. */
    guides: z.array(z.object({ title: z.string(), path: z.string() })).default([]),
    /** Piliers créés au premier lancement (sinon ceux par défaut). */
    pillars: z.array(z.object({ name: z.string(), color: z.string() })).optional(),
    /** Brief de marque de départ (champs de Marque › Identité). */
    brief: z.record(z.string(), z.string()).optional(),
    /** Charte de départ (« Rétablir la charte par défaut »). */
    brandKit: brandKitSchema.optional(),
  })
  .transform((w) => ({
    ...w,
    dbFile: w.dbFile ?? `${w.id}.db`,
    brandDoc: w.brandDoc ?? `${w.id.toUpperCase()}.md`,
  }));

export const workspacesFileSchema = z.object({
  workspaces: z.array(workspaceSchema).min(1),
});

export type Workspace = z.output<typeof workspaceSchema>;
export type WorkspaceId = string;

/** Espace unique quand `workspaces.json` n'existe pas. */
export const DEFAULT_WORKSPACES: Workspace[] = workspacesFileSchema.parse({
  workspaces: [{ id: "marque", name: "Ma marque" }],
}).workspaces;
