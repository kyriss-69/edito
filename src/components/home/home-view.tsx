"use client";

import { addWeeks, endOfDay, format, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, FilePlus2, GalleryHorizontalEnd, PartyPopper } from "lucide-react";
import Link from "next/link";

import { AiIcon } from "@/components/ai/ai-progress";
import { useOpenIdeas } from "@/components/ai/ideas-dialog";
import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { PageBody, PageHeader } from "@/components/page-header";
import { FormatIcon } from "@/components/posts/format-icon";
import { DueChip, MediaThumb } from "@/components/posts/post-card";
import { ColorDot } from "@/components/posts/platform-badge";
import { useNow } from "@/components/use-now";
import { Button } from "@/components/ui/button";
import { accountStatusOf, usedPlatforms } from "@/lib/accounts";
import { dayKey, isBelowTarget, weekDays } from "@/lib/calendar";
import { homeTodos } from "@/lib/home";
import { PLATFORMS } from "@/lib/platforms";
import type { PostDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { GettingStarted } from "./getting-started";

function HomeCard({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      {children} <ArrowRight className="size-3" />
    </Link>
  );
}

function PostRow({ post, now }: { post: PostDTO; now: number }) {
  const { meta, openPost } = useApp();
  const column = meta.columns.find((c) => c.id === post.columnId);
  const cover = post.media[0];
  return (
    <button
      type="button"
      onClick={() => openPost(post.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
    >
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {cover ? <MediaThumb media={cover} className="size-full" /> : <FormatIcon format={post.format} className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{post.title}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {column && (
            <span className="flex items-center gap-1">
              <ColorDot color={column.color} />
              {column.name}
            </span>
          )}
          <DueChip post={post} columnKind={column?.kind ?? "progress"} now={now} />
        </span>
      </span>
    </button>
  );
}

function TodoGroup({ title, tone, posts, now }: { title: string; tone?: "danger"; posts: PostDTO[]; now: number }) {
  if (!posts.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className={cn("px-2 text-xs font-medium text-muted-foreground", tone === "danger" && "text-destructive")}>
        {title} · {posts.length}
      </h3>
      {posts.slice(0, 6).map((post) => (
        <PostRow key={post.id} post={post} now={now} />
      ))}
      {posts.length > 6 && <p className="px-2 text-xs text-muted-foreground">et {posts.length - 6} autres…</p>}
    </div>
  );
}

/** Rythme visé par réseau : cette semaine et la suivante. */
function Rhythm({ now }: { now: number }) {
  const { meta, posts } = useApp();
  const weeks = [
    { label: "Cette semaine", days: weekDays(new Date(now)) },
    { label: "Semaine prochaine", days: weekDays(addWeeks(new Date(now), 1)) },
  ];
  return (
    <div className="flex flex-col gap-4">
      {weeks.map((week) => {
        const keys = new Set(week.days.map(dayKey));
        const inWeek = posts.filter((p) => p.scheduledAt !== null && keys.has(dayKey(p.scheduledAt)));
        const past = endOfDay(week.days[6]).getTime() < now;
        return (
          <div key={week.label} className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">{week.label}</span>
            {usedPlatforms(meta.accounts).map((id) => {
              const n = inWeek.filter((p) => p.platforms.some((x) => x.platform === id)).length;
              const target = meta.accounts.find((a) => a.platform === id)?.postsPerWeek ?? null;
              const below = isBelowTarget(n, target, past);
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <PlatformIcon platform={id} colored />
                  <span className="w-20">{PLATFORMS[id].label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className={cn("block h-full rounded-full", below ? "bg-destructive" : "bg-success")}
                      style={{ width: `${target ? Math.min(100, (n / target) * 100) : n ? 100 : 0}%` }}
                    />
                  </span>
                  <span className={cn("w-12 text-right text-xs tabular-nums", below && "font-medium text-destructive")}>
                    {n}
                    {target ? ` / ${target}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
      {!meta.accounts.some((a) => a.postsPerWeek) && (
        <p className="text-xs text-muted-foreground">
          Indique un rythme visé dans <Link href="/brand/accounts" className="underline">Réseaux sociaux</Link> pour
          suivre tes objectifs.
        </p>
      )}
    </div>
  );
}

/** Les 7 jours de la semaine en cours, avec leurs posts. */
function WeekStrip({ now }: { now: number }) {
  const { posts, openPost, newPost } = useApp();
  const days = weekDays(new Date(now));
  return (
    <div className="grid grid-cols-7 gap-1.5 max-sm:grid-cols-1">
      {days.map((day) => {
        const dayPosts = posts
          .filter((p) => p.scheduledAt !== null && dayKey(p.scheduledAt) === dayKey(day))
          .sort((a, b) => a.scheduledAt! - b.scheduledAt!);
        const today = isSameDay(day, now);
        return (
          <div
            key={day.getTime()}
            className={cn(
              "flex min-h-24 flex-col gap-1 rounded-lg border p-1.5",
              today && "border-primary/50 bg-primary/5",
              !dayPosts.length && "border-dashed",
            )}
          >
            <span className={cn("text-xs capitalize", today ? "font-semibold text-primary" : "text-muted-foreground")}>
              {format(day, "EEE d", { locale: fr })}
            </span>
            {dayPosts.slice(0, 3).map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => openPost(post.id)}
                className="truncate rounded bg-muted px-1.5 py-0.5 text-left text-[11px] font-medium hover:bg-accent"
                title={post.title}
              >
                {format(post.scheduledAt!, "HH:mm")} {post.title}
              </button>
            ))}
            {dayPosts.length > 3 && <span className="text-[11px] text-muted-foreground">+{dayPosts.length - 3}</span>}
            {!dayPosts.length && (
              <button
                type="button"
                onClick={() => {
                  const date = new Date(day);
                  date.setHours(10, 0, 0, 0);
                  newPost({ scheduledAt: date.getTime() });
                }}
                className="mt-auto rounded py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                + Prévoir
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Progress() {
  const { meta, posts } = useApp();
  const counts = meta.columns.map((c) => ({ column: c, count: posts.filter((p) => p.columnId === c.id).length }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <ul className="flex flex-col gap-1.5">
      {counts.map(({ column, count }) => (
        <li key={column.id} className="flex items-center gap-2 text-sm">
          <span className="flex w-36 min-w-0 items-center gap-1.5 truncate">
            <ColorDot color={column.color} />
            <span className="truncate">{column.name}</span>
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full" style={{ width: `${(count / max) * 100}%`, backgroundColor: column.color }} />
          </span>
          <span className="w-6 text-right text-xs text-muted-foreground tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}

function Accounts() {
  const { meta } = useApp();
  const accounts = meta.accounts.filter((account) => account.status !== "unused");
  return (
    <ul className="flex flex-col gap-2">
      {accounts.map((account) => {
        const status = accountStatusOf(account.status);
        const done = account.checklist.filter((c) => c.done).length;
        return (
          <li key={account.id} className="flex items-center gap-2.5 text-sm">
            <PlatformIcon platform={account.platform} colored className="size-5" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {account.handle ? `@${account.handle}` : PLATFORMS[account.platform].label}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ColorDot color={status.color} /> {status.label}
                {account.checklist.length > 0 && ` · checklist ${done}/${account.checklist.length}`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function HomeView() {
  const { meta, posts, newPost } = useApp();
  const openIdeas = useOpenIdeas();
  const now = useNow();
  const kinds = new Map(meta.columns.map((c) => [c.id, c.kind]));
  const todos = homeTodos(posts, (id) => kinds.get(id) ?? "progress", now);
  const nothingToDo = !todos.overdue.length && !todos.review.length && !todos.upcoming.length;
  const today = format(now, "EEEE d MMMM", { locale: fr });

  return (
    <>
      <PageHeader title="Accueil" description={today.charAt(0).toUpperCase() + today.slice(1)}>
        <Button variant="outline" size="sm" onClick={openIdeas} className="max-md:hidden">
          <AiIcon /> Idées avec l&apos;IA
        </Button>
        <Button variant="outline" size="sm" asChild className="max-md:hidden">
          <Link href="/studio?new=1">
            <GalleryHorizontalEnd /> Carrousel
          </Link>
        </Button>
        <Button size="sm" onClick={() => newPost()} className="max-md:hidden">
          <FilePlus2 /> Nouveau post
        </Button>
      </PageHeader>
      <PageBody>
        <div className="mx-auto grid max-w-6xl items-start gap-4 lg:grid-cols-3">
          <GettingStarted />
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <HomeCard title="À traiter" action={<CardLink href="/board">Tableau</CardLink>}>
              {nothingToDo ? (
                <div className="flex flex-col items-center gap-2 py-3 text-center text-sm text-muted-foreground">
                  <PartyPopper className="size-6 text-primary" />
                  Rien d&apos;urgent : pas de retard, rien à valider.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <TodoGroup title="En retard" tone="danger" posts={todos.overdue} now={now} />
                  <TodoGroup title="À valider" posts={todos.review} now={now} />
                  <TodoGroup title="Dans les 48 h, pas encore prêts" posts={todos.upcoming} now={now} />
                </div>
              )}
            </HomeCard>
            <HomeCard title="Cette semaine" action={<CardLink href="/calendar">Calendrier</CardLink>}>
              <WeekStrip now={now} />
            </HomeCard>
            <HomeCard title="Avancement" action={<CardLink href="/board">Tableau</CardLink>}>
              <Progress />
            </HomeCard>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <HomeCard title="Rythme par réseau" action={<CardLink href="/calendar">Calendrier</CardLink>}>
              <Rhythm now={now} />
            </HomeCard>
            <HomeCard title="Comptes" action={<CardLink href="/brand/accounts">Réseaux sociaux</CardLink>}>
              <Accounts />
            </HomeCard>
          </div>
        </div>
      </PageBody>
    </>
  );
}
