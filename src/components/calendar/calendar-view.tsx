"use client";

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  format,
  getISOWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarX2, ChevronLeft, ChevronRight, Inbox, Plus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { PlanningHeader } from "@/components/planning/planning-header";
import { usePostFilters } from "@/components/planning/use-post-filters";
import { FormatIcon } from "@/components/posts/format-icon";
import { MediaThumb } from "@/components/posts/post-card";
import { PlatformBadge } from "@/components/posts/platform-badge";
import { useNow } from "@/components/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_HOUR, dayKey, isBelowTarget, monthGrid, moveToDay, weekDays } from "@/lib/calendar";
import { usedPlatforms } from "@/lib/accounts";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { emptyDraft } from "@/lib/post-draft";
import { dueState } from "@/lib/post-status";
import type { PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { reschedulePost, savePost } from "@/server/actions";

type View = "month" | "week";

const UNSCHEDULED = "unscheduled";
const postKey = (id: number) => `post-${id}`;

/* ------------------------------------------------------------------ */
/* Éléments déplaçables                                               */
/* ------------------------------------------------------------------ */

function PostChip({ post, detailed = false, now }: { post: PostDTO; detailed?: boolean; now: number }) {
  const { meta } = useApp();
  const column = meta.columns.find((c) => c.id === post.columnId);
  const overdue = dueState(post.scheduledAt, column?.kind ?? "progress", now) === "overdue";
  const cover = post.media[0];
  return (
    <div
      className={cn(
        "flex flex-col gap-1 overflow-hidden rounded-md border border-l-[3px] bg-card px-1.5 py-1 text-left text-xs shadow-xs hover:shadow-sm",
        overdue && "bg-destructive/5",
      )}
      style={{ borderLeftColor: column?.color ?? "#94a3b8" }}
      title={column ? `${post.title} · ${column.name}${overdue ? " · en retard" : ""}` : post.title}
    >
      {detailed && cover && (
        <MediaThumb media={cover} className="-mx-1.5 -mt-1 mb-0.5 aspect-video w-[calc(100%+0.75rem)] max-w-none" />
      )}
      <div className="flex items-center gap-1">
        {!detailed && (
          <span className="flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted text-muted-foreground">
            {cover ? (
              <MediaThumb media={cover} className="size-full" />
            ) : (
              <FormatIcon format={post.format} className="size-2.5" />
            )}
          </span>
        )}
        {post.scheduledAt && (
          <span className={cn("font-medium tabular-nums text-muted-foreground", overdue && "text-destructive")}>
            {format(post.scheduledAt, "HH:mm")}
          </span>
        )}
        <span className="ml-auto flex gap-0.5">
          {post.platforms.map((p) => (
            <PlatformBadge key={p.platform} platform={p.platform} compact />
          ))}
        </span>
      </div>
      <span className={cn("font-medium", detailed ? "line-clamp-3" : "truncate")}>{post.title}</span>
    </div>
  );
}

function DraggablePost({ post, detailed, now }: { post: PostDTO; detailed?: boolean; now: number }) {
  const { openPost } = useApp();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: postKey(post.id) });
  return (
    <div
      ref={setNodeRef}
      className={cn("rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring", isDragging && "opacity-40")}
      onClick={() => openPost(post.id)}
      {...attributes}
      {...listeners}
    >
      <PostChip post={post} detailed={detailed} now={now} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ajout express sur un jour                                          */
/* ------------------------------------------------------------------ */

function QuickAddDay({ day, className }: { day: Date; className?: string }) {
  const { meta, newPost, openPost } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState(`${String(DEFAULT_HOUR).padStart(2, "0")}:00`);
  const [pending, startTransition] = useTransition();

  const scheduledAt = () => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(day);
    date.setHours(hours || 0, minutes || 0, 0, 0);
    return date.getTime();
  };

  function add() {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await savePost({ ...emptyDraft(meta), title: title.trim(), scheduledAt: scheduledAt() });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTitle("");
      setOpen(false);
      toast.success("Post planifié", { action: { label: "Ouvrir", onClick: () => openPost(result.data.id) } });
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
          aria-label={`Nouveau post le ${format(day, "d MMMM", { locale: fr })}`}
        >
          <Plus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <p className="text-sm font-medium capitalize">{format(day, "EEEE d MMMM", { locale: fr })}</p>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Titre du post"
            aria-label="Titre du post"
            className="h-8"
          />
          <Input
            type="time"
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
            aria-label="Heure"
            className="h-8 w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={() => {
              setOpen(false);
              newPost({ scheduledAt: scheduledAt() });
            }}
          >
            Plus de détails…
          </Button>
          <Button size="sm" className="ml-auto h-7" onClick={add} disabled={pending || !title.trim()}>
            Ajouter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Cases du calendrier                                                */
/* ------------------------------------------------------------------ */

function DayCell({
  day,
  posts,
  muted,
  tall,
  now,
}: {
  day: Date;
  posts: PostDTO[];
  muted?: boolean;
  tall?: boolean;
  now: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${day.getTime()}`, data: { day } });
  const today = isSameDay(day, now);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex min-w-0 flex-col gap-1 border-t border-l p-1.5 transition-colors",
        tall ? "min-h-[60vh]" : "min-h-28",
        muted && "bg-muted/40",
        isOver && "bg-primary/10",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs",
            muted && "text-muted-foreground",
            today && "bg-primary font-semibold text-primary-foreground",
          )}
        >
          {format(day, "d")}
        </span>
        <QuickAddDay day={day} />
      </div>
      <div className="flex flex-col gap-1">
        {posts.map((post) => (
          <DraggablePost key={post.id} post={post} detailed={tall} now={now} />
        ))}
      </div>
    </div>
  );
}

/** Rythme de publication visé par réseau utilisé (renseigné dans les fiches Réseaux sociaux). */
function useWeeklyTargets(): { id: PlatformId; target: number | null }[] {
  const { meta } = useApp();
  return usedPlatforms(meta.accounts).map((id) => ({
    id,
    target: meta.accounts.find((a) => a.platform === id)?.postsPerWeek ?? null,
  }));
}

function countFor(posts: PostDTO[], platform: PlatformId) {
  return posts.filter((p) => p.platforms.some((x) => x.platform === platform)).length;
}

function PlatformCounts({ posts, past }: { posts: PostDTO[]; past: boolean }) {
  const targets = useWeeklyTargets();
  return (
    <div className="flex flex-col gap-0.5">
      {targets.map(({ id, target }) => {
        const n = countFor(posts, id);
        return (
          <span
            key={id}
            title={`${n} post${n > 1 ? "s" : ""} ${PLATFORMS[id].label}${target ? ` sur ${target} visé${target > 1 ? "s" : ""}` : ""}`}
            className={cn(
              "text-[10px] tabular-nums",
              isBelowTarget(n, target, past) ? "font-semibold text-destructive" : "text-muted-foreground",
            )}
          >
            {PLATFORMS[id].short} {n}
            {target ? `/${target}` : ""}
          </span>
        );
      })}
    </div>
  );
}

/** Objectifs de la semaine affichée (ou de la semaine en cours), avec jauges. */
function WeekTargets({ posts, past, label }: { posts: PostDTO[]; past: boolean; label: string }) {
  const targets = useWeeklyTargets();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {targets.map(({ id, target }) => {
        const n = countFor(posts, id);
        const below = isBelowTarget(n, target, past);
        return (
          <span
            key={id}
            className={cn("flex items-center gap-1.5", below && "font-medium text-destructive")}
            title={target ? `${n} post${n > 1 ? "s" : ""} sur ${target} visé${target > 1 ? "s" : ""}` : undefined}
          >
            <PlatformIcon platform={id} colored className="size-3.5" />
            <span className="tabular-nums">
              {n}
              {target ? `/${target}` : ""}
            </span>
            {target ? (
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full", below ? "bg-destructive" : "bg-success")}
                  style={{ width: `${Math.min(100, (n / target) * 100)}%` }}
                />
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function UnscheduledPanel({ posts, now }: { posts: PostDTO[]; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED });
  return (
    <aside
      ref={setNodeRef}
      className={cn("flex w-64 shrink-0 flex-col border-l bg-card transition-colors max-lg:hidden", isOver && "bg-primary/5")}
    >
      <div className="border-b px-3 py-2.5">
        <h2 className="text-sm font-semibold">Non planifiés ({posts.length})</h2>
        <p className="text-xs text-muted-foreground">
          Glisse un post sur un jour pour le planifier, ou ici pour retirer sa date.
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2">
        {posts.map((post) => (
          <DraggablePost key={post.id} post={post} now={now} />
        ))}
        {posts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted-foreground">
            <CalendarX2 className="size-5" />
            Tous les posts sont planifiés.
          </div>
        )}
      </div>
    </aside>
  );
}

function PostListItem({ post, now, onOpen }: { post: PostDTO; now: number; onOpen?: () => void }) {
  const { openPost } = useApp();
  return (
    <button
      type="button"
      className="w-full rounded-md text-left"
      onClick={() => {
        onOpen?.();
        openPost(post.id);
      }}
    >
      <PostChip post={post} now={now} />
    </button>
  );
}

/** Sur les écrans étroits : la liste des posts sans date dans un tiroir. */
function UnscheduledDrawer({ posts, now }: { posts: PostDTO[]; now: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setOpen(true)}>
        <Inbox /> Non planifiés ({posts.length})
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-sm">
          <div className="border-b px-4 py-3 pr-10">
            <SheetTitle className="text-sm font-semibold">Non planifiés ({posts.length})</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Ouvre un post pour lui donner une date.
            </SheetDescription>
          </div>
          <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
            {posts.map((post) => (
              <PostListItem key={post.id} post={post} now={now} onOpen={() => setOpen(false)} />
            ))}
            {posts.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Tous les posts sont planifiés.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Sur mobile : les jours de la période affichée qui ont des posts, en liste. */
function Agenda({ days, byDay, now }: { days: Date[]; byDay: Map<string, PostDTO[]>; now: number }) {
  const shown = days.filter((day) => (byDay.get(dayKey(day)) ?? []).length || isSameDay(day, now));
  return (
    <div className="flex flex-col gap-4 md:hidden">
      {shown.map((day) => {
        const posts = byDay.get(dayKey(day)) ?? [];
        return (
          <section key={day.getTime()} className="flex flex-col gap-1.5">
            <h3
              className={cn(
                "flex items-center justify-between text-xs font-semibold capitalize",
                isSameDay(day, now) && "text-primary",
              )}
            >
              {format(day, "EEEE d MMMM", { locale: fr })}
              <QuickAddDay day={day} className="opacity-100" />
            </h3>
            {posts.length ? (
              posts.map((post) => <PostListItem key={post.id} post={post} now={now} />)
            ) : (
              <p className="text-xs text-muted-foreground">Rien de prévu ce jour-là.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vue principale                                                     */
/* ------------------------------------------------------------------ */

export function CalendarView() {
  const { meta, posts } = useApp();
  const { apply } = usePostFilters();
  const now = useNow();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [activeId, setActiveId] = useState<number | null>(null);

  // Dates modifiées localement en attendant la réponse du serveur.
  const [overrides, setOverrides] = useState<Map<number, number | null>>(new Map());
  const [syncedPosts, setSyncedPosts] = useState(posts);
  if (syncedPosts !== posts) {
    setSyncedPosts(posts);
    setOverrides(new Map());
  }

  const visible = useMemo(
    () =>
      apply(posts).map((p) =>
        overrides.has(p.id) ? { ...p, scheduledAt: overrides.get(p.id) ?? null } : p,
      ),
    [posts, apply, overrides],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, PostDTO[]>();
    for (const post of visible) {
      if (post.scheduledAt === null) continue;
      const key = dayKey(post.scheduledAt);
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledAt! - b.scheduledAt!);
    return map;
  }, [visible]);

  const unscheduled = useMemo(() => {
    const columnOrder = new Map(meta.columns.map((c) => [c.id, c.position]));
    return visible
      .filter((p) => p.scheduledAt === null)
      .sort(
        (a, b) =>
          (columnOrder.get(a.columnId) ?? 0) - (columnOrder.get(b.columnId) ?? 0) ||
          a.position - b.position,
      );
  }, [visible, meta.columns]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(Number(String(active.id).split("-")[1]));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const id = Number(String(active.id).split("-")[1]);
    const post = visible.find((p) => p.id === id);
    if (!post) return;

    let next: number | null;
    if (over.id === UNSCHEDULED) {
      next = null;
    } else {
      const day = over.data.current?.day as Date | undefined;
      if (!day) return;
      next = moveToDay(post.scheduledAt, day);
    }
    if (next === post.scheduledAt) return;

    setOverrides((prev) => new Map(prev).set(id, next));
    reschedulePost(id, next).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  const step = (delta: number) =>
    setCursor((c) => (view === "month" ? addMonths(c, delta) : addWeeks(c, delta)));

  const days = weekDays(cursor);
  const label =
    view === "month"
      ? format(cursor, "MMMM yyyy", { locale: fr })
      : `${format(days[0], "d MMM", { locale: fr })} – ${format(days[6], "d MMM yyyy", { locale: fr })}`;

  // Objectifs : la semaine affichée (vue semaine) ou la semaine en cours (vue mois).
  const targetDays = view === "week" ? days : weekDays(new Date(now));
  const targetPosts = targetDays.flatMap((d) => byDay.get(dayKey(d)) ?? []);
  const agendaDays =
    view === "week"
      ? days
      : monthGrid(cursor)
          .flat()
          .filter((d) => d >= startOfMonth(cursor) && d <= endOfMonth(cursor));

  const activePost = activeId !== null ? visible.find((p) => p.id === activeId) : undefined;

  return (
    <>
      <PlanningHeader>
        <div className="flex flex-wrap items-center gap-1">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as View)}
            aria-label="Affichage du calendrier"
          >
            <ToggleGroupItem value="month">Mois</ToggleGroupItem>
            <ToggleGroupItem value="week">Semaine</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" className="ml-1" onClick={() => setCursor(new Date())}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => step(-1)} aria-label="Précédent">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => step(1)} aria-label="Suivant">
            <ChevronRight />
          </Button>
          <span className="min-w-32 text-sm font-medium capitalize">{label}</span>
          <UnscheduledDrawer posts={unscheduled} now={now} />
        </div>
      </PlanningHeader>

      <DndContext
        id="calendar"
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-4 md:px-6">
            <WeekTargets
              posts={targetPosts}
              past={endOfDay(targetDays[6]) < new Date(now)}
              label={view === "week" ? "Objectifs de la semaine :" : "Cette semaine :"}
            />
            <Agenda days={agendaDays} byDay={byDay} now={now} />
            <div className="overflow-hidden rounded-lg border-r border-b bg-card max-md:hidden">
              <div
                className={cn(
                  "grid text-xs font-medium text-muted-foreground",
                  view === "month" ? "grid-cols-[3rem_repeat(7,minmax(0,1fr))]" : "grid-cols-7",
                )}
              >
                {view === "month" && <div className="border-t border-l px-1.5 py-2">Sem.</div>}
                {days.map((day) => (
                  <div key={day.getTime()} className="border-t border-l px-2 py-2 capitalize">
                    {view === "month" ? format(day, "EEE", { locale: fr }) : format(day, "EEE d", { locale: fr })}
                  </div>
                ))}
              </div>

              {view === "month" ? (
                monthGrid(cursor).map((week) => {
                  const weekPosts = week.flatMap((d) => byDay.get(dayKey(d)) ?? []);
                  return (
                    <div key={week[0].getTime()} className="grid grid-cols-[3rem_repeat(7,minmax(0,1fr))]">
                      <div className="flex flex-col gap-1 border-t border-l p-1.5">
                        <span className="text-xs font-medium text-muted-foreground">S{getISOWeek(week[0])}</span>
                        <PlatformCounts posts={weekPosts} past={endOfDay(week[6]) < new Date(now)} />
                      </div>
                      {week.map((day) => (
                        <DayCell
                          key={day.getTime()}
                          day={day}
                          posts={byDay.get(dayKey(day)) ?? []}
                          muted={!isSameMonth(day, cursor)}
                          now={now}
                        />
                      ))}
                    </div>
                  );
                })
              ) : (
                <div className="grid grid-cols-7">
                  {days.map((day) => (
                    <DayCell key={day.getTime()} day={day} posts={byDay.get(dayKey(day)) ?? []} tall now={now} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <UnscheduledPanel posts={unscheduled} now={now} />
        </div>
        <DragOverlay>{activePost && <PostChip post={activePost} now={now} />}</DragOverlay>
      </DndContext>
    </>
  );
}
