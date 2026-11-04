import { defaultPostPlatforms } from "./accounts";
import type { PostResearch } from "./ai/research";
import type { AiMode } from "./ai/tasks";
import { DEFAULT_CHECKLIST } from "./platforms";
import type { ChecklistItemDTO, Meta, PostDTO, PostPlatformDTO } from "./types";

export type NewPostDefaults = {
  columnId?: number;
  scheduledAt?: number | null;
  /** Pré-remplit le post à partir d'un modèle de la bibliothèque. */
  templateId?: number;
};

export type Draft = {
  title: string;
  caption: string;
  format: string;
  columnId: number;
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
  platforms: PostPlatformDTO[];
  checklist: ChecklistItemDTO[];
};

export function draftFromPost(post: PostDTO): Draft {
  return {
    title: post.title,
    caption: post.caption,
    format: post.format,
    columnId: post.columnId,
    scheduledAt: post.scheduledAt,
    priority: post.priority,
    pillarId: post.pillarId,
    campaignId: post.campaignId,
    hashtags: post.hashtags,
    cta: post.cta,
    link: post.link,
    notes: post.notes,
    publishedUrl: post.publishedUrl,
    aiMode: post.aiMode,
    research: post.research,
    platforms: post.platforms.map((p) => ({ ...p })),
    checklist: post.checklist.map(({ label, done }) => ({ label, done })),
  };
}

export function emptyDraft(meta: Meta, defaults: NewPostDefaults = {}): Draft {
  const template = meta.templates.find((t) => t.id === defaults.templateId);
  const pillarExists = meta.pillars.some((p) => p.id === template?.pillarId);
  return {
    title: template?.title ?? "",
    caption: template?.caption ?? "",
    format: template?.format ?? "image",
    columnId: defaults.columnId ?? meta.columns[0]?.id ?? 0,
    scheduledAt: defaults.scheduledAt ?? null,
    priority: "medium",
    pillarId: template && pillarExists ? template.pillarId : null,
    campaignId: null,
    hashtags: template?.hashtags ?? "",
    cta: template?.cta ?? "",
    link: "",
    notes: template?.notes ?? "",
    publishedUrl: "",
    aiMode: "open",
    research: null,
    platforms: (template ? template.platforms : defaultPostPlatforms(meta.accounts)).map((platform) => ({
      platform,
      customCaption: null,
      customHashtags: null,
    })),
    checklist: (template?.checklist.length ? template.checklist : DEFAULT_CHECKLIST).map((label) => ({
      label,
      done: false,
    })),
  };
}
