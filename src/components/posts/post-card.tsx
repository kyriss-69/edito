"use client";

import { CalendarClock, CheckSquare, CircleAlert, Flag, ImageIcon, Video } from "lucide-react";

import { useApp } from "@/components/app-provider";
import type { BoardDensity } from "@/lib/preferences";
import { dueState, readiness, scheduleLabel } from "@/lib/post-status";
import type { MediaDTO, PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { FormatIcon } from "./format-icon";
import { ColorDot, PlatformBadge } from "./platform-badge";

export function MediaThumb({ media, className }: { media: MediaDTO; className?: string }) {
  if (media.mimeType.startsWith("video/")) {
    return (
      <video
        src={`${media.url}#t=0.1`}
        muted
        preload="metadata"
        className={cn("object-cover", className)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- médias locaux servis par l'API
  return <img src={media.url} alt={media.originalName} className={cn("object-cover", className)} />;
}

/** Date de publication, colorée selon l'urgence (en retard, dans les 24 h…). */
export function DueChip({ post, columnKind, now }: { post: PostDTO; columnKind: string; now: number }) {
  const state = dueState(post.scheduledAt, columnKind, now);
  if (post.scheduledAt === null) {
    // Un post « Planifié » sans date est un oubli à signaler.
    return columnKind === "scheduled" ? (
      <span className="flex items-center gap-1 font-medium text-warning">
        <CalendarClock className="size-3.5" /> Sans date
      </span>
    ) : null;
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1 tabular-nums",
        state === "overdue" && "rounded bg-destructive/10 px-1 font-medium text-destructive",
        state === "soon" && "rounded bg-warning/10 px-1 font-medium text-warning",
      )}
      title={state === "overdue" ? "En retard : la date est passée et le post n'est pas publié" : undefined}
    >
      <CalendarClock className="size-3.5" />
      {scheduleLabel(post.scheduledAt, now)}
    </span>
  );
}

function CoverBadge({ post }: { post: PostDTO }) {
  const cover = post.media[0];
  if (!cover) return null;
  const extra = post.media.length - 1;
  return (
    <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-px text-[10px] text-white">
      {cover.mimeType.startsWith("video/") ? <Video className="size-2.5" /> : <ImageIcon className="size-2.5" />}
      {extra > 0 && `+${extra}`}
    </span>
  );
}

export function PostCard({
  post,
  density = "compact",
  selected = false,
  dragging = false,
  now,
  children,
}: {
  post: PostDTO;
  density?: BoardDensity;
  selected?: boolean;
  dragging?: boolean;
  /** Heure de référence (pour « en retard »), voir useNow. */
  now: number;
  /** Actions affichées au survol (coin supérieur droit). */
  children?: React.ReactNode;
}) {
  const { meta } = useApp();
  const pillar = meta.pillars.find((p) => p.id === post.pillarId);
  const campaign = meta.campaigns.find((c) => c.id === post.campaignId);
  const column = meta.columns.find((c) => c.id === post.columnId);
  const kind = column?.kind ?? "progress";
  const cover = post.media[0];
  const done = post.checklist.filter((c) => c.done).length;
  // Ce qui manque ne compte qu'une fois le post censé être prêt (à valider, planifié).
  const missing =
    kind === "review" || kind === "scheduled"
      ? readiness(post).items.filter((i) => !i.done && (i.id === "media" || i.id === "caption"))
      : [];

  const thumb = (
    <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
      {cover ? (
        <MediaThumb media={cover} className="size-full" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <FormatIcon format={post.format} className="size-4" />
        </span>
      )}
      {post.media.length > 1 && <CoverBadge post={post} />}
    </div>
  );

  return (
    <div
      className={cn(
        "group/card relative overflow-hidden rounded-lg border bg-card text-left shadow-xs transition-shadow hover:shadow-md",
        pillar && "shadow-[inset_3px_0_0_var(--pillar)] hover:shadow-[inset_3px_0_0_var(--pillar),0_4px_6px_-1px_rgb(0_0_0/0.1)]",
        selected && "ring-2 ring-primary",
        dragging && "rotate-2 shadow-lg ring-2 ring-primary/40",
      )}
      style={pillar ? ({ "--pillar": pillar.color } as React.CSSProperties) : undefined}
    >
      {density === "cover" && cover && (
        <div className="relative aspect-[4/3] bg-muted">
          <MediaThumb media={cover} className="size-full" />
          <CoverBadge post={post} />
        </div>
      )}
      <div className={cn("flex gap-2.5 p-2.5", pillar && "pl-3")}>
        {density !== "cover" && thumb}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start gap-1.5 pr-5">
            <p className="line-clamp-2 flex-1 text-sm leading-snug font-medium">{post.title}</p>
            {post.priority === "high" && (
              <Flag className="mt-0.5 size-3.5 shrink-0 fill-destructive text-destructive" aria-label="Priorité haute" />
            )}
          </div>
          {density === "detailed" && post.caption.trim() && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{post.caption}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {post.platforms.map((p) => (
              <PlatformBadge key={p.platform} platform={p.platform} compact />
            ))}
            <FormatIcon format={post.format} />
            <DueChip post={post} columnKind={kind} now={now} />
            {post.checklist.length > 0 && (
              <span
                className={cn("flex items-center gap-1 tabular-nums", done === post.checklist.length && "text-success")}
                title="Checklist"
              >
                <CheckSquare className="size-3.5" />
                {done}/{post.checklist.length}
              </span>
            )}
            {missing.length > 0 && (
              <span
                className="flex items-center text-warning"
                title={`À compléter : ${missing.map((m) => m.label.toLowerCase()).join(", ")}`}
              >
                <CircleAlert className="size-3.5" />
                <span className="sr-only">À compléter : {missing.map((m) => m.label).join(", ")}</span>
              </span>
            )}
          </div>
          {density === "detailed" && (pillar || campaign) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {pillar && (
                <span className="flex items-center gap-1">
                  <ColorDot color={pillar.color} />
                  {pillar.name}
                </span>
              )}
              {campaign && (
                <span className="flex items-center gap-1">
                  <ColorDot color={campaign.color} />
                  {campaign.name}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {children && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          {children}
        </div>
      )}
    </div>
  );
}
