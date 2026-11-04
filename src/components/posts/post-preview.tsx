"use client";

import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  ImageIcon,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Music2,
  Play,
  Repeat2,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app-provider";
import { PlatformIcon } from "@/components/icons/platform-icon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { extractHashtags } from "@/lib/captions";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import type { Draft } from "@/lib/post-draft";
import type { MediaDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Longueur de légende visible sur Instagram avant « plus ». */
const INSTAGRAM_FOLD = 125;

function Avatar({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- photo de profil locale servie par l'API
    <img src={url} alt="" className={cn("rounded-full object-cover", className)} />
  ) : (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary uppercase",
        className,
      )}
    >
      {name.charAt(0)}
    </span>
  );
}

function PreviewMedia({ media, className, playing }: { media: MediaDTO | undefined; className?: string; playing?: boolean }) {
  if (!media) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground", className)}>
        <ImageIcon className="size-8" />
        <span className="text-xs">Ajoute un média pour le voir ici</span>
      </div>
    );
  }
  if (media.mimeType.startsWith("video/")) {
    return (
      <video
        key={media.id}
        src={media.url}
        muted
        loop
        playsInline
        autoPlay={playing}
        controls={!playing}
        className={cn("object-cover", className)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- médias locaux servis par l'API
  return <img key={media.id} src={media.url} alt={media.originalName} className={cn("object-cover", className)} />;
}

/** Légende avec hashtags mis en valeur. */
function RichCaption({ text, tagClass }: { text: string; tagClass: string }) {
  const tags = new Set(extractHashtags(text));
  return (
    <>
      {text.split(/(#[\p{L}\p{N}_]+)/u).map((part, i) =>
        tags.has(part) ? (
          <span key={i} className={tagClass}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function InstagramPreview({ handle, avatar, text, media }: { handle: string; avatar: string | null; text: string; media: MediaDTO[] }) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const current = Math.min(index, Math.max(media.length - 1, 0));
  const folded = !expanded && text.length > INSTAGRAM_FOLD;

  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-card text-[13px] text-foreground shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar url={avatar} name={handle} className="size-8" />
        <span className="font-semibold">{handle}</span>
        <MoreHorizontal className="ml-auto size-4" />
      </div>
      <div className="relative">
        <PreviewMedia media={media[current]} className="aspect-[4/5] w-full" />
        {media.length > 1 && (
          <>
            <span className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
              {current + 1}/{media.length}
            </span>
            {current > 0 && (
              <button
                type="button"
                onClick={() => setIndex(current - 1)}
                className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-black shadow"
                aria-label="Média précédent"
              >
                <ChevronLeft className="size-4" />
              </button>
            )}
            {current < media.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex(current + 1)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-white/80 p-1 text-black shadow"
                aria-label="Média suivant"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="size-5" />
        <MessageCircle className="size-5" />
        <Send className="size-5" />
        {media.length > 1 && (
          <div className="mx-auto flex gap-1">
            {media.map((m, i) => (
              <span key={m.id} className={cn("size-1.5 rounded-full", i === current ? "bg-info" : "bg-muted-foreground/30")} />
            ))}
          </div>
        )}
        <Bookmark className="ml-auto size-5" />
      </div>
      <p className="px-3 pt-2 pb-3 leading-snug whitespace-pre-line">
        <span className="font-semibold">{handle}</span>{" "}
        {text ? (
          <>
            <RichCaption text={folded ? `${text.slice(0, INSTAGRAM_FOLD).trimEnd()}…` : text} tagClass="text-info" />
            {folded && (
              <button type="button" onClick={() => setExpanded(true)} className="ml-1 text-muted-foreground">
                plus
              </button>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Ta légende apparaîtra ici.</span>
        )}
      </p>
    </div>
  );
}

function TikTokPreview({ handle, avatar, text, media }: { handle: string; avatar: string | null; text: string; media: MediaDTO[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-black text-[13px] text-white shadow-xl">
      <PreviewMedia media={media[0]} className="absolute inset-0 size-full" playing />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
        <Avatar url={avatar} name={handle} className="size-10 border-2 border-white" />
        <Heart className="size-7 fill-white/90" />
        <MessageCircle className="size-7" />
        <Bookmark className="size-7" />
        <Share2 className="size-7" />
      </div>
      <div className="absolute right-14 bottom-4 left-3 flex flex-col gap-1">
        <span className="font-semibold">@{handle}</span>
        <p className={cn("leading-snug whitespace-pre-line", !expanded && "line-clamp-2")}>
          {text ? <RichCaption text={text} tagClass="font-semibold" /> : <span className="opacity-70">Ta légende apparaîtra ici.</span>}
        </p>
        {!expanded && text.length > 80 && (
          <button type="button" onClick={() => setExpanded(true)} className="self-start text-xs font-semibold opacity-80">
            plus
          </button>
        )}
        <span className="flex items-center gap-1 text-xs opacity-80">
          <Music2 className="size-3" /> Son original · {handle}
        </span>
      </div>
    </div>
  );
}

/** Texte coupé à `fold` caractères, avec « plus » pour le déplier. */
function FoldedText({ text, fold, more, tagClass }: { text: string; fold: number; more: string; tagClass: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-muted-foreground">Ta légende apparaîtra ici.</span>;
  const folded = !expanded && text.length > fold;
  return (
    <>
      <RichCaption text={folded ? `${text.slice(0, fold).trimEnd()}…` : text} tagClass={tagClass} />
      {folded && (
        <button type="button" onClick={() => setExpanded(true)} className="ml-1 text-muted-foreground">
          {more}
        </button>
      )}
    </>
  );
}

function YouTubePreview({
  handle,
  avatar,
  title,
  text,
  media,
}: {
  handle: string;
  avatar: string | null;
  title: string;
  text: string;
  media: MediaDTO[];
}) {
  // YouTube affiche les 3 premiers hashtags au-dessus du titre.
  const tags = extractHashtags(text).slice(0, 3);
  const isVideo = media[0]?.mimeType.startsWith("video/");
  return (
    <div className="w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border-[6px] border-foreground/85 bg-card text-[13px] text-foreground shadow-xl">
      <div className="relative aspect-video bg-black">
        <PreviewMedia media={media[0]} className="size-full" />
        {!isVideo && media[0] && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-12 items-center justify-center rounded-xl bg-[#ff0000] text-white">
              <Play className="size-5 fill-white" />
            </span>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        {tags.length > 0 && <p className="text-xs text-info">{tags.join(" ")}</p>}
        <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{title || "Titre de la vidéo"}</p>
        <p className="text-xs text-muted-foreground">0 vue · à l&apos;instant</p>
        <div className="flex items-center gap-2">
          <Avatar url={avatar} name={handle} className="size-8" />
          <span className="font-semibold">{handle}</span>
          <span className="ml-auto rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
            S&apos;abonner
          </span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5">
            <ThumbsUp className="size-3.5" /> J&apos;aime
          </span>
          <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5">
            <Share2 className="size-3.5" /> Partager
          </span>
        </div>
        <p className="rounded-xl bg-muted p-2.5 text-xs leading-snug whitespace-pre-line">
          <FoldedText text={text} fold={150} more="plus" tagClass="text-info" />
        </p>
      </div>
    </div>
  );
}

/** Aperçu d'un fil d'actualité (LinkedIn, Facebook) : en-tête, texte coupé, médias, actions. */
function FeedPreview({
  name,
  avatar,
  subtitle,
  squareAvatar,
  text,
  fold,
  more,
  media,
  actions,
}: {
  name: string;
  avatar: string | null;
  subtitle: string;
  squareAvatar?: boolean;
  text: string;
  fold: number;
  more: string;
  media: MediaDTO[];
  actions: { icon: typeof ThumbsUp; label: string }[];
}) {
  const extra = media.length - 3;
  return (
    <div className="w-full max-w-[380px] overflow-hidden rounded-xl border bg-card text-[13px] text-foreground shadow-xl">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Avatar url={avatar} name={name} className={cn("size-10", squareAvatar && "rounded-md")} />
        <div className="min-w-0 leading-tight">
          <p className="truncate font-semibold">{name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {subtitle} · <Globe className="size-3" />
          </p>
        </div>
        <MoreHorizontal className="ml-auto size-4 text-muted-foreground" />
      </div>
      <p className="px-3 py-2.5 leading-snug whitespace-pre-line">
        <FoldedText text={text} fold={fold} more={more} tagClass="font-semibold text-info" />
      </p>
      {media.length > 0 &&
        (media.length === 1 ? (
          <PreviewMedia media={media[0]} className="aspect-square w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-0.5">
            <PreviewMedia media={media[0]} className="col-span-2 aspect-[2/1] w-full" />
            {media.slice(1, 3).map((m, i) => (
              <div key={m.id} className="relative">
                <PreviewMedia media={m} className="aspect-square w-full" />
                {i === 1 && extra > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xl font-semibold text-white">
                    +{extra}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      <div className="flex justify-around border-t px-2 py-2 text-xs font-medium text-muted-foreground">
        {actions.map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <Icon className="size-4" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function XPreview({
  name,
  handle,
  avatar,
  text,
  media,
}: {
  name: string;
  handle: string;
  avatar: string | null;
  text: string;
  media: MediaDTO[];
}) {
  const shown = media.slice(0, 4);
  return (
    <div className="flex w-full max-w-[380px] gap-2.5 rounded-xl border bg-card p-3 text-[13px] text-foreground shadow-xl">
      <Avatar url={avatar} name={name} className="size-10 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex min-w-0 items-center gap-1 leading-tight">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-muted-foreground">@{handle} · 1 min</span>
          <MoreHorizontal className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </p>
        <p className="leading-snug whitespace-pre-line">
          {text ? (
            <RichCaption text={text} tagClass="text-info" />
          ) : (
            <span className="text-muted-foreground">Ta légende apparaîtra ici.</span>
          )}
        </p>
        {shown.length > 0 && (
          <div className={cn("grid gap-0.5 overflow-hidden rounded-xl border", shown.length > 1 && "grid-cols-2")}>
            {shown.map((m) => (
              <PreviewMedia
                key={m.id}
                media={m}
                className={cn("w-full", shown.length === 1 ? "aspect-video" : "aspect-square")}
              />
            ))}
          </div>
        )}
        <div className="flex justify-between pr-4 text-muted-foreground">
          <MessageCircle className="size-4" />
          <Repeat2 className="size-4" />
          <Heart className="size-4" />
          <Bookmark className="size-4" />
          <Share2 className="size-4" />
        </div>
      </div>
    </div>
  );
}

/** Aperçu du post tel qu'il apparaîtra sur chaque réseau. */
export function PostPreview({ draft, media }: { draft: Draft; media: MediaDTO[] }) {
  const { meta } = useApp();
  const platforms = draft.platforms.map((p) => p.platform);
  const [chosen, setChosen] = useState<PlatformId>(platforms[0] ?? "instagram");
  const platform = platforms.includes(chosen) ? chosen : (platforms[0] ?? "instagram");

  const account = meta.accounts.find((a) => a.platform === platform);
  const brandName = meta.ai.brand.name || "Ta marque";
  const handle = account?.handle || brandName.toLowerCase().replace(/\s+/g, "");
  const avatar = account?.avatarUrl ?? null;
  const entry = draft.platforms.find((p) => p.platform === platform);
  const caption = (entry?.customCaption ?? draft.caption).trim();
  const text = [caption, (entry?.customHashtags ?? draft.hashtags).trim()].filter(Boolean).join("\n\n");

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6">
      {platforms.length > 1 && (
        <ToggleGroup
          type="single"
          value={platform}
          onValueChange={(v) => v && setChosen(v as PlatformId)}
          className="max-w-full flex-wrap justify-center"
        >
          {platforms.map((id) => (
            <ToggleGroupItem key={id} value={id}>
              <PlatformIcon platform={id} colored />
              {PLATFORMS[id].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {platform === "tiktok" && <TikTokPreview handle={handle} avatar={avatar} text={text} media={media} />}
      {platform === "instagram" && <InstagramPreview handle={handle} avatar={avatar} text={text} media={media} />}
      {platform === "youtube" && (
        <YouTubePreview handle={handle} avatar={avatar} title={draft.title} text={text} media={media} />
      )}
      {platform === "linkedin" && (
        <FeedPreview
          name={brandName}
          avatar={avatar}
          subtitle="Page entreprise · à l'instant"
          squareAvatar
          text={text}
          fold={210}
          more="voir plus"
          media={media}
          actions={[
            { icon: ThumbsUp, label: "J'aime" },
            { icon: MessageSquare, label: "Commenter" },
            { icon: Repeat2, label: "Republier" },
            { icon: Send, label: "Envoyer" },
          ]}
        />
      )}
      {platform === "x" && <XPreview name={brandName} handle={handle} avatar={avatar} text={text} media={media} />}
      {platform === "facebook" && (
        <FeedPreview
          name={brandName}
          avatar={avatar}
          subtitle="À l'instant"
          text={text}
          fold={250}
          more="Voir plus"
          media={media}
          actions={[
            { icon: ThumbsUp, label: "J'aime" },
            { icon: MessageCircle, label: "Commenter" },
            { icon: Share2, label: "Partager" },
          ]}
        />
      )}
      <p className="max-w-xs text-center text-xs text-muted-foreground">
        Aperçu indicatif : le rendu exact dépend de l&apos;application et de l&apos;appareil.
      </p>
    </div>
  );
}
