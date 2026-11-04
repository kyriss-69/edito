"use client";

import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRODUCT } from "@/lib/product";
import { switchWorkspace } from "@/server/actions";

/** Nom de l'app et de la marque ; un clic change d'espace de travail (une base par marque). */
export function WorkspaceMenu() {
  const { meta } = useApp();
  const [pending, startTransition] = useTransition();
  const workspace = meta.ai.brand.name || meta.workspace.name;

  function open(id: string) {
    if (id === meta.workspace.id) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Rechargement complet : posts, fiches ouvertes et brouillons appartiennent à l'autre espace.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="-mx-1 flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left leading-tight transition-colors hover:bg-accent"
          aria-label="Changer d'espace de travail"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{PRODUCT.name}</div>
            <div className="truncate text-xs text-muted-foreground">{workspace}</div>
          </div>
          {pending ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Espace de travail</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={meta.workspace.id} onValueChange={open}>
          {meta.workspaces.map((w) => (
            <DropdownMenuRadioItem key={w.id} value={w.id} disabled={pending}>
              {w.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
