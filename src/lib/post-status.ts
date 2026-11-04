import { differenceInCalendarDays, format, isSameYear } from "date-fns";
import { fr } from "date-fns/locale";

import { isDoneKind } from "./columns";
import type { PostDTO } from "./types";

const DAY = 24 * 60 * 60 * 1000;

/**
 * État de la date de publication d'un post :
 * - `overdue` : date passée alors que le post n'est ni publié ni archivé ;
 * - `soon` : dans les prochaines 24 h ;
 * - `upcoming` : plus tard ;
 * - `done` : post publié ou archivé ;
 * - `none` : pas de date.
 */
export type DueState = "none" | "overdue" | "soon" | "upcoming" | "done";

export function dueState(scheduledAt: number | null, columnKind: string, now: number): DueState {
  if (scheduledAt === null) return "none";
  if (isDoneKind(columnKind)) return "done";
  if (scheduledAt < now) return "overdue";
  if (scheduledAt - now <= DAY) return "soon";
  return "upcoming";
}

/** « Aujourd'hui 10:00 », « Demain 10:00 », « Hier 18:30 », sinon « Lun. 14 oct. · 10:00 ». */
export function scheduleLabel(scheduledAt: number, now: number): string {
  const time = format(scheduledAt, "HH:mm");
  const days = differenceInCalendarDays(scheduledAt, now);
  if (days === 0) return `Aujourd'hui ${time}`;
  if (days === 1) return `Demain ${time}`;
  if (days === -1) return `Hier ${time}`;
  const pattern = isSameYear(scheduledAt, now) ? "EEE d MMM" : "d MMM yyyy";
  const date = format(scheduledAt, pattern, { locale: fr });
  return `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time}`;
}

export type ReadinessItem = { id: string; label: string; done: boolean };

/** Ce qu'il faut pour qu'un post soit prêt à publier. */
export function readiness(post: Pick<
  PostDTO,
  "media" | "format" | "caption" | "platforms" | "hashtags" | "scheduledAt" | "checklist"
>): { items: ReadinessItem[]; done: number; total: number } {
  const checklistDone = post.checklist.every((c) => c.done);
  const items: ReadinessItem[] = [
    { id: "media", label: "Média", done: post.media.length > 0 || post.format === "live" },
    {
      id: "caption",
      label: "Légende",
      done: Boolean(post.caption.trim()) || post.platforms.some((p) => p.customCaption?.trim()),
    },
    { id: "hashtags", label: "Hashtags", done: Boolean(post.hashtags.trim()) },
    { id: "platforms", label: "Réseaux", done: post.platforms.length > 0 },
    { id: "date", label: "Date", done: post.scheduledAt !== null },
    { id: "checklist", label: "Checklist", done: checklistDone },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length };
}
