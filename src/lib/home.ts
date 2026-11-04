import { dueState, readiness } from "./post-status";
import type { PostDTO } from "./types";

const HOURS_48 = 48 * 60 * 60 * 1000;

const byDate = (a: PostDTO, b: PostDTO) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0);

/**
 * Ce qui demande de l'attention sur l'Accueil :
 * - `overdue` : date passée, post ni publié ni archivé ;
 * - `review` : posts dans une colonne « À valider » (hors retards) ;
 * - `upcoming` : prévus dans les 48 h mais pas encore prêts (hors retards).
 */
export function homeTodos(
  posts: PostDTO[],
  kindOf: (columnId: number) => string,
  now: number,
): { overdue: PostDTO[]; review: PostDTO[]; upcoming: PostDTO[] } {
  const overdue = posts.filter((p) => dueState(p.scheduledAt, kindOf(p.columnId), now) === "overdue");
  const late = new Set(overdue.map((p) => p.id));
  const review = posts.filter((p) => !late.has(p.id) && kindOf(p.columnId) === "review");
  const upcoming = posts.filter((p) => {
    if (late.has(p.id) || p.scheduledAt === null || p.scheduledAt - now > HOURS_48) return false;
    if (dueState(p.scheduledAt, kindOf(p.columnId), now) === "done") return false;
    const { done, total } = readiness(p);
    return done < total;
  });
  return { overdue: overdue.sort(byDate), review, upcoming: upcoming.sort(byDate) };
}
