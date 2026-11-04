import { PLATFORM_IDS, type PlatformId } from "./platforms";

export const ACCOUNT_STATUSES = [
  { id: "todo", label: "À créer", color: "#94a3b8" },
  { id: "in_progress", label: "En cours", color: "#f59e0b" },
  { id: "active", label: "Actif", color: "#22c55e" },
  // Réseau que la marque n'utilise pas : masqué dans le reste de l'app.
  { id: "unused", label: "Non utilisé", color: "#d4d4d8" },
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number]["id"];

export function accountStatusOf(id: string) {
  return ACCOUNT_STATUSES.find((s) => s.id === id) ?? ACCOUNT_STATUSES[0];
}

export const ACCOUNT_TYPES = [
  { id: "business", label: "Professionnel / Business" },
  { id: "creator", label: "Créateur" },
  { id: "personal", label: "Personnel" },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["id"];

/** Checklist de création pré-remplie pour chaque réseau. */
export const DEFAULT_ACCOUNT_CHECKLIST: Record<PlatformId, string[]> = {
  instagram: [
    "Réserver le pseudo (le même sur tous les réseaux si possible)",
    "Passer en compte professionnel (Paramètres → Type de compte)",
    "Ajouter la photo de profil (logo)",
    "Écrire la bio",
    "Ajouter le lien en bio",
    "Activer la double authentification",
    "Préparer 6 à 9 posts avant le lancement",
    "Créer les stories à la une (présentation, FAQ…)",
    "Publier les 3 premiers posts",
  ],
  tiktok: [
    "Réserver le pseudo (le même sur tous les réseaux si possible)",
    "Passer en compte Business (nécessaire pour le lien en bio)",
    "Ajouter la photo de profil (logo)",
    "Écrire la bio",
    "Ajouter le lien en bio",
    "Activer la double authentification",
    "Préparer 3 à 5 vidéos avant le lancement",
    "Publier les 3 premières vidéos",
  ],
  youtube: [
    "Créer la chaîne avec le compte Google de la marque",
    "Réserver le @pseudo (le même sur tous les réseaux si possible)",
    "Ajouter la photo de profil (logo) et la bannière",
    "Écrire la description de la chaîne",
    "Ajouter les liens (site, autres réseaux)",
    "Activer la double authentification",
    "Préparer la bande-annonce de la chaîne",
    "Publier les 3 premières vidéos ou Shorts",
  ],
  linkedin: [
    "Créer la page entreprise",
    "Choisir l'adresse de la page (le même nom que sur les autres réseaux)",
    "Ajouter le logo et l'image de couverture",
    "Écrire le slogan et la présentation de la page",
    "Renseigner le site web, le secteur et la taille de l'entreprise",
    "Ajouter les membres de l'équipe comme administrateurs",
    "Inviter son réseau à suivre la page",
    "Publier les 3 premiers posts",
  ],
  facebook: [
    "Créer la page Facebook",
    "Choisir le nom d'utilisateur de la page",
    "Ajouter la photo de profil (logo) et la couverture",
    "Écrire la bio (intro)",
    "Ajouter le site web et le bouton d'action",
    "Relier la page au compte Instagram (Meta Business Suite)",
    "Activer la double authentification",
    "Publier les 3 premiers posts",
  ],
  x: [
    "Réserver le @pseudo (le même sur tous les réseaux si possible)",
    "Ajouter la photo de profil (logo) et la bannière",
    "Écrire la bio",
    "Ajouter le site web",
    "Activer la double authentification",
    "Épingler un post de présentation",
    "Publier les 3 premiers posts",
  ],
};

/** Réseaux cochés par défaut sur un nouveau post lors de la création des fiches. */
export const DEFAULT_ON_POSTS: readonly PlatformId[] = ["instagram", "tiktok"];

type AccountLike = { platform: PlatformId; status: string; defaultOnPosts: boolean };

/** Réseaux utilisés par la marque (tous sauf « Non utilisé »), dans l'ordre habituel. */
export function usedPlatforms(accounts: readonly AccountLike[]): PlatformId[] {
  if (!accounts.length) return [...PLATFORM_IDS];
  const used = new Set(accounts.filter((a) => a.status !== "unused").map((a) => a.platform));
  return PLATFORM_IDS.filter((id) => used.has(id));
}

/** Réseaux cochés d'office sur un nouveau post. */
export function defaultPostPlatforms(accounts: readonly AccountLike[]): PlatformId[] {
  if (!accounts.length) return [...DEFAULT_ON_POSTS];
  const chosen = new Set(
    accounts.filter((a) => a.defaultOnPosts && a.status !== "unused").map((a) => a.platform),
  );
  return PLATFORM_IDS.filter((id) => chosen.has(id));
}

/** Réseaux à proposer : ceux utilisés, plus ceux déjà choisis (même s'ils ne le sont plus). */
export function platformChoices(accounts: readonly AccountLike[], selected: readonly PlatformId[] = []) {
  const shown = new Set([...usedPlatforms(accounts), ...selected]);
  return PLATFORM_IDS.filter((id) => shown.has(id));
}

/** "@Ma.Marque " → "Ma.Marque" */
export function cleanHandle(handle: string) {
  return handle.trim().replace(/^@+/, "").replace(/\s+/g, "");
}
