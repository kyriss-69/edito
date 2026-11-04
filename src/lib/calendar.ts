import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

const WEEK = { weekStartsOn: 1 } as const;

/** Semaines (lundi → dimanche) couvrant le mois de `date`. */
export function monthGrid(date: Date): Date[][] {
  const start = startOfWeek(startOfMonth(date), WEEK);
  const end = endOfWeek(endOfMonth(date), WEEK);
  const weeks: Date[][] = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return weeks;
}

export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date, WEEK);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export const DEFAULT_HOUR = 10;

/** Place un post sur `day` en conservant son heure (10:00 s'il n'en avait pas). */
export function moveToDay(scheduledAt: number | null, day: Date): number {
  const target = startOfDay(day);
  if (scheduledAt === null) {
    target.setHours(DEFAULT_HOUR, 0, 0, 0);
  } else {
    const current = new Date(scheduledAt);
    target.setHours(current.getHours(), current.getMinutes(), 0, 0);
  }
  return target.getTime();
}

export function dayKey(date: Date | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Vrai si une semaine à venir manque de posts : sous l'objectif hebdomadaire
 * du compte s'il y en a un, sinon aucune publication.
 */
export function isBelowTarget(count: number, target: number | null, past: boolean): boolean {
  if (past) return false;
  return target ? count < target : count === 0;
}
