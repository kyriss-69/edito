"use client";

import { ChevronDown, FilePlus2, GalleryHorizontalEnd, LayoutTemplate, MessagesSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AiIcon } from "@/components/ai/ai-progress";
import { useOpenIdeas } from "@/components/ai/ideas-dialog";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Bouton « Créer » : post, post depuis un modèle, carrousel, idées avec l'IA. */
export function CreateMenu({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { meta, newPost } = useApp();
  const openIdeas = useOpenIdeas();
  const router = useRouter();

  const trigger = compact ? (
    <Button size="icon" className={className} aria-label="Créer">
      <Plus />
    </Button>
  ) : (
    <Button className={cn("w-full justify-start", className)}>
      <Plus /> Créer
      <ChevronDown className="ml-auto opacity-70" />
    </Button>
  );

  return (
    <DropdownMenu>
      {compact ? (
        <Hint label="Créer" side="right">
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </Hint>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuItem onSelect={() => newPost()}>
          <FilePlus2 /> Nouveau post
          <DropdownMenuShortcut>N</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <LayoutTemplate /> Depuis un modèle
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            {meta.templates.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => newPost({ templateId: t.id })}>
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{t.name}</span>
                  {t.description && (
                    <span className="truncate text-xs text-muted-foreground">{t.description}</span>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            {meta.templates.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem asChild>
              <Link href="/brand/templates">Gérer les modèles</Link>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => router.push("/studio?new=1")}>
          <GalleryHorizontalEnd /> Nouveau carrousel
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openIdeas}>
          <AiIcon /> Idées de posts avec l&apos;IA
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/assistant")}>
          <MessagesSquare /> Discuter avec l&apos;assistant
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
