export const PLATFORM_IDS = ["instagram", "tiktok", "youtube", "linkedin", "facebook", "x"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

export type PlatformConfig = {
  id: PlatformId;
  label: string;
  short: string;
  color: string;
  /** Nombre max de caractères de la légende (hashtags compris). */
  captionLimit: number;
  /** Nombre max de hashtags, si la plateforme en impose un. */
  hashtagLimit: number | null;
  /** Nombre max de médias dans un carrousel. */
  carouselLimit: number;
  /** Nombre max de caractères de la bio du profil. */
  bioLimit: number;
  /** Adresse du profil à partir du pseudo. */
  profileUrl: (handle: string) => string;
};

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    short: "IG",
    color: "#e1306c",
    captionLimit: 2200,
    // 5 hashtags maximum par post depuis décembre 2025 (30 auparavant).
    hashtagLimit: 5,
    carouselLimit: 20,
    bioLimit: 150,
    profileUrl: (handle) => `https://www.instagram.com/${handle}/`,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    short: "TT",
    color: "#111827",
    captionLimit: 4000,
    hashtagLimit: null,
    carouselLimit: 35,
    bioLimit: 80,
    profileUrl: (handle) => `https://www.tiktok.com/@${handle}`,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    short: "YT",
    color: "#ff0000",
    // Description de la vidéo.
    captionLimit: 5000,
    // Au-delà de 60 hashtags, YouTube les ignore tous.
    hashtagLimit: 60,
    // Posts YouTube : 10 images depuis août 2025.
    carouselLimit: 10,
    // Description de la chaîne.
    bioLimit: 1000,
    profileUrl: (handle) => `https://www.youtube.com/@${handle}`,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    short: "LI",
    color: "#0a66c2",
    captionLimit: 3000,
    hashtagLimit: null,
    carouselLimit: 20,
    // Présentation (« À propos ») d'une page entreprise.
    bioLimit: 2000,
    profileUrl: (handle) => `https://www.linkedin.com/company/${handle}/`,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    short: "FB",
    color: "#1877f2",
    captionLimit: 63206,
    hashtagLimit: null,
    // Valeur prudente : les Pages acceptent davantage de photos par post.
    carouselLimit: 10,
    // Bio (« Intro ») de la page.
    bioLimit: 101,
    profileUrl: (handle) => `https://www.facebook.com/${handle}`,
  },
  x: {
    id: "x",
    label: "X",
    short: "X",
    color: "#000000",
    // Limite d'un compte standard (les comptes Premium vont au-delà).
    captionLimit: 280,
    hashtagLimit: null,
    carouselLimit: 4,
    bioLimit: 160,
    profileUrl: (handle) => `https://x.com/${handle}`,
  },
};

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORM_IDS as readonly string[]).includes(value);
}

export const FORMATS = [
  { id: "image", label: "Post image" },
  { id: "carousel", label: "Carrousel" },
  { id: "video", label: "Vidéo" },
  { id: "story", label: "Story" },
  { id: "live", label: "Live" },
] as const;
export type FormatId = (typeof FORMATS)[number]["id"];

export function formatLabel(id: string) {
  return FORMATS.find((f) => f.id === id)?.label ?? id;
}

/**
 * Format adapté aux médias ajoutés, quand le post est encore au format par
 * défaut (« Post image ») : vidéo s'il y en a une, carrousel s'il y a
 * plusieurs images. `null` = rien à changer.
 */
export function suggestFormat(format: string, mimeTypes: readonly string[]): FormatId | null {
  if (format !== "image") return null;
  if (mimeTypes.some((type) => type.startsWith("video/"))) return "video";
  if (mimeTypes.length > 1) return "carousel";
  return null;
}

export const PRIORITIES = [
  { id: "low", label: "Basse", color: "#94a3b8" },
  { id: "medium", label: "Moyenne", color: "#3b82f6" },
  { id: "high", label: "Haute", color: "#ef4444" },
] as const;
export type PriorityId = (typeof PRIORITIES)[number]["id"];

export function priorityOf(id: string) {
  return PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];
}

/** Checklist ajoutée à chaque nouveau post. */
export const DEFAULT_CHECKLIST = [
  "Visuel / vidéo prêt",
  "Légende relue",
  "Hashtags ajoutés",
  "Sous-titres ajoutés (vidéo)",
];
