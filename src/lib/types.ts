import type { BrandDocInfo } from "./ai/brand-doc";
import type { PlatformSkillInfo } from "./ai/platform-skills";
import type { PostResearch } from "./ai/research";
import type { AiMode } from "./ai/tasks";
import type { AiSettings } from "./ai/settings";
import type { SiteNotes } from "./ai/site";
import type { AppShotsInfo } from "./app-shots";
import type { BrandKit } from "./brand";
import type { CarouselStyle, Slide } from "./carousel";
import type { ColumnKind } from "./columns";
import type { PlatformId } from "./platforms";
import type { UiPreferences } from "./preferences";
import type { WorkspaceId } from "./workspaces";

export type ColumnDTO = { id: number; name: string; color: string; kind: ColumnKind; position: number };
export type TagDTO = { id: number; name: string; color: string; position: number };

export type MediaDTO = {
  id: number;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  position: number;
};

export type ChecklistItemDTO = {
  id?: number;
  label: string;
  done: boolean;
};

export type PostPlatformDTO = {
  platform: PlatformId;
  customCaption: string | null;
  /** Hashtags propres à ce réseau (sinon ceux du post). */
  customHashtags: string | null;
};

export type PostDTO = {
  id: number;
  title: string;
  caption: string;
  format: string;
  columnId: number;
  position: number;
  /** Timestamp en millisecondes, ou null si non planifié. */
  scheduledAt: number | null;
  priority: string;
  pillarId: number | null;
  campaignId: number | null;
  hashtags: string;
  cta: string;
  link: string;
  notes: string;
  publishedUrl: string;
  aiMode: AiMode;
  research: PostResearch | null;
  createdAt: number;
  updatedAt: number;
  platforms: PostPlatformDTO[];
  media: MediaDTO[];
  checklist: ChecklistItemDTO[];
};

export type AccountDTO = {
  id: number;
  platform: PlatformId;
  status: string;
  handle: string;
  profileUrl: string;
  accountType: string;
  bio: string;
  bioLink: string;
  followersGoal: number | null;
  postsPerWeek: number | null;
  /** Réseau coché d'office sur les nouveaux posts. */
  defaultOnPosts: boolean;
  notes: string;
  /** Adresse de la photo de profil, ou null s'il n'y en a pas. */
  avatarUrl: string | null;
  updatedAt: number;
  checklist: ChecklistItemDTO[];
};

export type AssetDTO = {
  id: number;
  url: string;
  title: string;
  category: string;
  notes: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
};

export type HashtagGroupDTO = { id: number; name: string; hashtags: string; position: number };

export type TemplateDTO = {
  id: number;
  name: string;
  description: string;
  title: string;
  caption: string;
  hashtags: string;
  cta: string;
  format: string;
  platforms: PlatformId[];
  pillarId: number | null;
  notes: string;
  checklist: string[];
  position: number;
};

export type Meta = {
  /** Espace de travail ouvert (une base par marque, voir `src/lib/workspaces.ts`). */
  workspace: {
    id: WorkspaceId;
    name: string;
    /** Charte d'origine (« Rétablir la charte par défaut »). */
    brandKit: BrandKit;
    /** Bouton « Écrans de l'app » de la médiathèque (`appShots` de `workspaces.json`). */
    appShots: AppShotsInfo | null;
  };
  /** Tous les espaces (`workspaces.json`). */
  workspaces: { id: WorkspaceId; name: string }[];
  columns: ColumnDTO[];
  pillars: TagDTO[];
  campaigns: TagDTO[];
  accounts: AccountDTO[];
  ai: AiSettings;
  /** Une clé d'API OpenRouter est enregistrée (la clé reste côté serveur). */
  openrouterKey: boolean;
  /** Document de référence de l'espace (`brand/MARQUE.md`…) envoyé à l'assistant. */
  brandDoc: BrandDocInfo;
  platformSkills: PlatformSkillInfo[];
  /** Analyse du site de la marque, envoyée à l'assistant. */
  site: SiteNotes;
  brand: BrandKit;
  library: AssetDTO[];
  hashtagGroups: HashtagGroupDTO[];
  templates: TemplateDTO[];
  carousels: CarouselDTO[];
  /** Préférences d'affichage. */
  ui: UiPreferences;
};

export type CarouselDTO = {
  id: number;
  title: string;
  description: string;
  mockupAssetId: number | null;
  slides: Slide[];
  style: CarouselStyle;
  postId: number | null;
  createdAt: number;
  updatedAt: number;
};
