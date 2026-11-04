import "server-only";

import { asc, desc } from "drizzle-orm";

import { getDb } from "@/db";
import { getPlatformSkillsInfo } from "@/server/ai/platform-skills";
import {
  campaigns,
  carousels,
  columns,
  hashtagGroups,
  libraryAssets,
  pillars,
  postTemplates,
} from "@/db/schema";
import { parseCarouselStyle, parseSlides } from "@/lib/carousel";
import { isColumnKind } from "@/lib/columns";
import { parseResearch } from "@/lib/ai/research";
import { isPlatformId, PLATFORM_IDS } from "@/lib/platforms";
import { parseJsonList } from "@/lib/templates";
import type { AccountDTO, AssetDTO, CarouselDTO, Meta, PostDTO, TemplateDTO } from "@/lib/types";

import { getBrandDocInfo } from "./brand-doc";
import { getAiSettings, getBrandKit, getOpenRouterKey, getSiteNotes, getUiPreferences } from "./settings";
import { getActiveWorkspace, listWorkspaces, workspaceBrandKit } from "./workspace";

export function getMeta(): Meta {
  const db = getDb();
  const { id, name, appShots } = getActiveWorkspace();
  return {
    workspace: {
      id,
      name,
      brandKit: workspaceBrandKit(id),
      appShots: appShots
        ? {
            appName: appShots.appName,
            baseUrl: appShots.baseUrl,
            accounts: Object.values(appShots.accounts).map(({ email, label }) => ({ email, label })),
            shots: appShots.shots.map(({ key, title }) => ({ key, title })),
          }
        : null,
    },
    workspaces: listWorkspaces().map((w) => ({ id: w.id, name: w.name })),
    columns: db.select().from(columns).orderBy(asc(columns.position)).all().map(
      ({ id, name, color, kind, position }) => ({
        id,
        name,
        color,
        kind: isColumnKind(kind) ? kind : "progress",
        position,
      }),
    ),
    pillars: db.select().from(pillars).orderBy(asc(pillars.position)).all().map(
      ({ id, name, color, position }) => ({ id, name, color, position }),
    ),
    campaigns: db
      .select()
      .from(campaigns)
      .orderBy(asc(campaigns.position))
      .all()
      .map(({ id, name, color, position }) => ({ id, name, color, position })),
    accounts: getAccounts(),
    ai: getAiSettings(),
    openrouterKey: Boolean(getOpenRouterKey()),
    brandDoc: getBrandDocInfo(),
    platformSkills: getPlatformSkillsInfo(),
    site: getSiteNotes(),
    brand: getBrandKit(),
    library: getLibrary(),
    hashtagGroups: getDb()
      .select()
      .from(hashtagGroups)
      .orderBy(asc(hashtagGroups.position), asc(hashtagGroups.id))
      .all()
      .map(({ id, name, hashtags, position }) => ({ id, name, hashtags, position })),
    templates: getTemplates(),
    carousels: getCarousels(),
    ui: getUiPreferences(),
  };
}

function getCarousels(): CarouselDTO[] {
  return getDb()
    .select()
    .from(carousels)
    .orderBy(desc(carousels.updatedAt), desc(carousels.id))
    .all()
    .map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      mockupAssetId: c.mockupAssetId,
      slides: parseSlides(readJson(c.slides)),
      style: parseCarouselStyle(readJson(c.style)),
      postId: c.postId,
      createdAt: c.createdAt.getTime(),
      updatedAt: c.updatedAt.getTime(),
    }));
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function getLibrary(): AssetDTO[] {
  return getDb()
    .select()
    .from(libraryAssets)
    .orderBy(desc(libraryAssets.createdAt), desc(libraryAssets.id))
    .all()
    .map((a) => ({
      id: a.id,
      url: `/api/library/${a.id}?f=${a.fileName}`,
      title: a.title,
      category: a.category,
      notes: a.notes,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt.getTime(),
    }));
}

function getTemplates(): TemplateDTO[] {
  return getDb()
    .select()
    .from(postTemplates)
    .orderBy(asc(postTemplates.position), asc(postTemplates.id))
    .all()
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      title: t.title,
      caption: t.caption,
      hashtags: t.hashtags,
      cta: t.cta,
      format: t.format,
      platforms: parseJsonList(t.platforms).filter(isPlatformId),
      pillarId: t.pillarId,
      notes: t.notes,
      checklist: parseJsonList(t.checklist),
      position: t.position,
    }));
}

function getAccounts(): AccountDTO[] {
  const rows = getDb()
    .query.socialAccounts.findMany({
      with: { checklist: { orderBy: (c, { asc }) => [asc(c.position), asc(c.id)] } },
    })
    .sync();
  return rows
    .filter((row) => isPlatformId(row.platform))
    .sort(
      (a, b) =>
        PLATFORM_IDS.indexOf(a.platform as AccountDTO["platform"]) -
        PLATFORM_IDS.indexOf(b.platform as AccountDTO["platform"]),
    )
    .map((row) => ({
      id: row.id,
      platform: row.platform as AccountDTO["platform"],
      status: row.status,
      handle: row.handle,
      profileUrl: row.profileUrl,
      accountType: row.accountType,
      bio: row.bio,
      bioLink: row.bioLink,
      followersGoal: row.followersGoal,
      postsPerWeek: row.postsPerWeek,
      defaultOnPosts: row.defaultOnPosts,
      notes: row.notes,
      avatarUrl: row.avatarFileName
        ? `/api/accounts/${row.id}/avatar?v=${row.updatedAt.getTime()}`
        : null,
      updatedAt: row.updatedAt.getTime(),
      checklist: row.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done })),
    }));
}

export function getPosts(): PostDTO[] {
  const rows = getDb().query.posts.findMany({
    orderBy: (p, { asc }) => [asc(p.position), asc(p.id)],
    with: {
      platforms: true,
      media: { orderBy: (m, { asc }) => [asc(m.position), asc(m.id)] },
      checklist: { orderBy: (c, { asc }) => [asc(c.position), asc(c.id)] },
    },
  }).sync();

  return rows.map((row) => ({
    ...row,
    aiMode: row.aiMode === "strict" ? "strict" : "open",
    research: parseResearch(row.research),
    scheduledAt: row.scheduledAt ? row.scheduledAt.getTime() : null,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    platforms: row.platforms
      .filter((p) => isPlatformId(p.platform))
      .map((p) => ({
        platform: p.platform as PostDTO["platforms"][number]["platform"],
        customCaption: p.customCaption,
        customHashtags: p.customHashtags,
      })),
    media: row.media.map((m) => ({
      id: m.id,
      url: `/api/media/${m.id}?f=${m.fileName}`,
      originalName: m.originalName,
      mimeType: m.mimeType,
      size: m.size,
      position: m.position,
    })),
    checklist: row.checklist.map((c) => ({
      id: c.id,
      label: c.label,
      done: c.done,
    })),
  }));
}
