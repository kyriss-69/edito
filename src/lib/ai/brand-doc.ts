/**
 * Document de référence de la marque (`brand/MARQUE.md`…,
 * selon l'espace de travail, voir `WORKSPACES`) : la source de vérité envoyée
 * au modèle avec chaque demande.
 */

/** Emplacement du document d'un espace, relatif à la racine du projet. */
export const brandDocPath = (fileName: string) => `brand/${fileName}`;
/** Au-delà, la fin du document est ignorée (il occuperait tout le contexte du modèle). */
export const BRAND_DOC_MAX_CHARS = 30_000;

export type BrandDocInfo = { path: string } & (
  /** `folder` : dossier où le fichier a été cherché ; `files` : ce qu'il contient (pour aider à le placer). */
  | { found: false; folder: string; files: string[] }
  | { found: true; chars: number; tokens: number; truncated: boolean; updatedAt: number }
);

/**
 * Noms acceptés pour le document attendu (`docName`, ex. MARQUE.md) : quelle
 * que soit la casse, y compris « .md.txt » (extension masquée sous Windows).
 */
export function isBrandDocName(fileName: string, docName: string): boolean {
  const lower = fileName.toLowerCase();
  const expected = docName.toLowerCase();
  return lower === expected || lower === `${expected}.txt`;
}

/** Estimation grossière du nombre de tokens d'un texte en français. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Nettoie le document et le coupe à la limite, de préférence entre deux paragraphes. */
export function prepareBrandDoc(raw: string): { text: string; truncated: boolean } {
  const text = raw
    .replace(/^﻿/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= BRAND_DOC_MAX_CHARS) return { text, truncated: false };
  const cut = text.slice(0, BRAND_DOC_MAX_CHARS);
  const paragraph = cut.lastIndexOf("\n\n");
  return {
    text: `${paragraph > BRAND_DOC_MAX_CHARS * 0.8 ? cut.slice(0, paragraph) : cut}\n\n[… suite du document non transmise …]`,
    truncated: true,
  };
}
