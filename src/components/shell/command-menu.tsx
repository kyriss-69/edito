"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FilePlus2, GalleryHorizontalEnd, Keyboard, LayoutTemplate, MessagesSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AiIcon } from "@/components/ai/ai-progress";
import { useOpenIdeas } from "@/components/ai/ideas-dialog";
import { useApp } from "@/components/app-provider";
import { ColorDot } from "@/components/posts/platform-badge";
import { useTheme } from "@/components/theme-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { THEMES } from "@/lib/preferences";

import { NAV_BRAND, NAV_MAIN, NAV_SETTINGS, PLANNING_VIEWS } from "./nav";
import { THEME_ICONS } from "./theme-menu";

/** Nombre de posts proposés tant que rien n'est tapé. */
const RECENT_POSTS = 6;

/** Palette de commandes (⌘K) : créer, aller à une page, retrouver un post ou un carrousel. */
export function CommandMenu({
  open,
  onOpenChange,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowShortcuts: () => void;
}) {
  const { meta, posts, newPost, openPost } = useApp();
  const { setTheme } = useTheme();
  const openIdeas = useOpenIdeas();
  const router = useRouter();
  const [search, setSearch] = useState("");

  /** Ferme la palette puis lance l'action. */
  const run = (action: () => void) => () => {
    onOpenChange(false);
    setSearch("");
    action();
  };

  const columnById = new Map(meta.columns.map((c) => [c.id, c]));
  const sortedPosts = [...posts].sort((a, b) => b.updatedAt - a.updatedAt);
  const shownPosts = search.trim() ? sortedPosts : sortedPosts.slice(0, RECENT_POSTS);
  const pages = [
    ...NAV_MAIN.filter((item) => item.href !== "/board"),
    ...PLANNING_VIEWS,
    ...NAV_BRAND,
    NAV_SETTINGS,
  ];

  return (
    <CommandDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
      title="Rechercher ou lancer une action"
      loop
    >
      <CommandInput value={search} onValueChange={setSearch} placeholder="Rechercher un post, une page, une action…" />
      <CommandList>
        <CommandEmpty>Aucun résultat.</CommandEmpty>

        <CommandGroup heading="Créer">
          <CommandItem value="Nouveau post créer" onSelect={run(() => newPost())}>
            <FilePlus2 /> Nouveau post
            <Kbd className="ml-auto">N</Kbd>
          </CommandItem>
          <CommandItem value="Nouveau carrousel créer studio" onSelect={run(() => router.push("/studio?new=1"))}>
            <GalleryHorizontalEnd /> Nouveau carrousel
          </CommandItem>
          <CommandItem value="Idées de posts avec l'IA assistant" onSelect={run(openIdeas)}>
            <AiIcon /> Idées de posts avec l&apos;IA
          </CommandItem>
          <CommandItem
            value="Nouvelle discussion avec l'assistant chat internet capture"
            onSelect={run(() => router.push("/assistant"))}
          >
            <MessagesSquare /> Discuter avec l&apos;assistant
          </CommandItem>
          {search.trim() &&
            meta.templates.map((t) => (
              <CommandItem
                key={t.id}
                value={`Nouveau post depuis le modèle ${t.name} ${t.id}`}
                onSelect={run(() => newPost({ templateId: t.id }))}
              >
                <LayoutTemplate /> Nouveau post depuis « {t.name} »
              </CommandItem>
            ))}
        </CommandGroup>

        {shownPosts.length > 0 && (
          <CommandGroup heading={search.trim() ? "Posts" : "Posts récents"}>
            {shownPosts.map((post) => {
              const column = columnById.get(post.columnId);
              return (
                <CommandItem
                  key={post.id}
                  value={`post ${post.id} ${post.title}`}
                  keywords={[post.hashtags, column?.name ?? ""]}
                  onSelect={run(() => openPost(post.id))}
                >
                  <ColorDot color={column?.color ?? "#94a3b8"} />
                  <span className="truncate">{post.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {post.scheduledAt ? format(post.scheduledAt, "d MMM", { locale: fr }) : column?.name}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {search.trim() && meta.carousels.length > 0 && (
          <CommandGroup heading="Carrousels">
            {meta.carousels.map((carousel) => (
              <CommandItem
                key={carousel.id}
                value={`carrousel ${carousel.id} ${carousel.title}`}
                onSelect={run(() => router.push(`/studio/${carousel.id}`))}
              >
                <GalleryHorizontalEnd />
                <span className="truncate">{carousel.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Aller à">
          {pages.map((page) => (
            <CommandItem key={page.href} value={`Aller à ${page.label}`} onSelect={run(() => router.push(page.href))}>
              <page.icon /> {page.label}
              {"shortcut" in page && <Kbd className="ml-auto">{page.shortcut}</Kbd>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Aide">
          <CommandItem value="Raccourcis clavier aide" onSelect={run(onShowShortcuts)}>
            <Keyboard /> Raccourcis clavier
            <Kbd className="ml-auto">?</Kbd>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Thème">
          {THEMES.map((t) => {
            const Icon = THEME_ICONS[t.id];
            return (
              <CommandItem key={t.id} value={`Thème ${t.label}`} onSelect={run(() => setTheme(t.id))}>
                <Icon /> Thème {t.label.toLowerCase()}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
