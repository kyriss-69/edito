export const ASSET_CATEGORIES = [
  { id: "logo", label: "Logos" },
  { id: "brand", label: "Charte & identité" },
  { id: "mockup", label: "Mockups" },
  { id: "app", label: "Écrans de l'app" },
  { id: "screenshot", label: "Captures web" },
  { id: "photo", label: "Photos" },
  { id: "video", label: "Vidéos" },
  { id: "other", label: "Autres" },
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number]["id"];

export function assetCategoryLabel(id: string) {
  return ASSET_CATEGORIES.find((c) => c.id === id)?.label ?? "Autres";
}

/** Catégorie proposée par défaut selon le type de fichier. */
export function guessCategory(mimeType: string): AssetCategory {
  return mimeType.startsWith("video/") ? "video" : "photo";
}

/** Titre lisible à partir d'un nom de fichier : "logo_marque-v2.png" → "logo marque v2". */
export function titleFromFileName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Sans titre";
}

/**
 * Adresse d'un fichier de la médiathèque d'après son numéro. Le numéro dépend de
 * l'espace de travail ; `?v=2` évite les réponses gardées par le navigateur
 * avant les espaces (mises en cache comme « immuables »).
 */
export const libraryImageUrl = (assetId: number) => `/api/library/${assetId}?v=2`;
