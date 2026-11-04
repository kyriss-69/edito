import "server-only";

import fs from "node:fs";

import { prepareBrandDoc } from "@/lib/ai/brand-doc";

import { getActiveWorkspace } from "./workspace";

/** Au-delà, la fin des guides est coupée (ils s'ajoutent au document de référence). */
const GUIDES_MAX_CHARS = 8_000;

/**
 * Guides de l'espace ouvert (`guides` dans `WORKSPACES`), relus à chaque demande :
 * un fichier modifié est pris en compte tout de suite. Les fichiers absents sont ignorés.
 */
export function readWorkspaceGuides(): string | null {
  const parts: string[] = [];
  for (const guide of getActiveWorkspace().guides) {
    try {
      const { text } = prepareBrandDoc(fs.readFileSync(guide.path, "utf8"));
      if (text) parts.push(`## ${guide.title}\n\n${text}`);
    } catch {
      // Fichier déplacé ou supprimé : l'assistant fait sans.
    }
  }
  const text = parts.join("\n\n");
  if (!text) return null;
  return text.length > GUIDES_MAX_CHARS ? `${text.slice(0, GUIDES_MAX_CHARS)}\n\n[… suite non transmise …]` : text;
}
