import "server-only";

import fs from "node:fs";
import path from "node:path";

import { DEFAULT_BRAND_KIT, type BrandKit } from "@/lib/brand";
import { DATA_DIR, WORKSPACE_FILE } from "@/lib/paths";
import { DEFAULT_WORKSPACES, workspacesFileSchema, type Workspace, type WorkspaceId } from "@/lib/workspaces";

// App locale mono-utilisateur : l'espace ouvert vaut pour toute l'app, mémorisé
// dans `data/workspace.json` (gardé en mémoire entre deux changements).
const globalForWorkspace = globalThis as unknown as {
  editoWorkspace?: WorkspaceId;
  editoWorkspaces?: Workspace[];
};

/** Espaces déclarés dans `workspaces.json` (sinon « Ma marque »). */
export function listWorkspaces(): Workspace[] {
  if (!globalForWorkspace.editoWorkspaces) {
    const file = process.env.EDITO_WORKSPACES ?? path.join(process.cwd(), "workspaces.json");
    let list = DEFAULT_WORKSPACES;
    if (fs.existsSync(/*turbopackIgnore: true*/ file)) {
      const parsed = workspacesFileSchema.safeParse(JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")));
      // Erreur franche plutôt qu'un espace vide : tes bases resteraient invisibles.
      if (!parsed.success) throw new Error(`workspaces.json invalide : ${parsed.error.message}`);
      list = parsed.data.workspaces;
    }
    globalForWorkspace.editoWorkspaces = list;
  }
  return globalForWorkspace.editoWorkspaces;
}

/** Premier espace de la liste : ouvert par défaut, sa connexion IA sert de modèle aux autres. */
export function mainWorkspace(): Workspace {
  return listWorkspaces()[0];
}

export function isWorkspaceId(value: unknown): value is WorkspaceId {
  return listWorkspaces().some((w) => w.id === value);
}

export function getWorkspace(id: WorkspaceId): Workspace {
  return listWorkspaces().find((w) => w.id === id) ?? mainWorkspace();
}

/** Charte d'origine d'un espace (« Rétablir la charte par défaut »). */
export function workspaceBrandKit(id: WorkspaceId): BrandKit {
  return getWorkspace(id).brandKit ?? DEFAULT_BRAND_KIT;
}

function readWorkspaceFile(): WorkspaceId {
  try {
    const { id } = JSON.parse(fs.readFileSync(WORKSPACE_FILE, "utf8")) as { id?: unknown };
    return isWorkspaceId(id) ? id : mainWorkspace().id;
  } catch {
    return mainWorkspace().id;
  }
}

export function getActiveWorkspace(): Workspace {
  globalForWorkspace.editoWorkspace ??= readWorkspaceFile();
  return getWorkspace(globalForWorkspace.editoWorkspace);
}

export function setActiveWorkspace(id: WorkspaceId) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(WORKSPACE_FILE, JSON.stringify({ id }));
  globalForWorkspace.editoWorkspace = id;
}
