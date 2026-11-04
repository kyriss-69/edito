"use client";

import { Menu } from "lucide-react";

import { useShell } from "@/components/shell/app-frame";
import { CreateMenu } from "@/components/shell/create-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bouton du menu, affiché seulement sur mobile (la barre latérale y est masquée). */
export function MobileNavButton() {
  const { openMobileNav } = useShell();
  return (
    <Button variant="ghost" size="icon-sm" className="-ml-1 md:hidden" onClick={openMobileNav} aria-label="Menu">
      <Menu />
    </Button>
  );
}

/** En-tête d'une page : titre, navigation éventuelle (onglets) et actions propres à la page. */
export function PageHeader({
  title,
  description,
  nav,
  children,
  className,
}: {
  title: string;
  description?: string;
  /** Onglets ou sélecteur affichés à côté du titre. */
  nav?: React.ReactNode;
  /** Actions, alignées à droite. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex min-h-14 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b bg-card px-4 py-2.5 md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <MobileNavButton />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{title}</h1>
          {description && <p className="truncate text-xs text-muted-foreground max-sm:hidden">{description}</p>}
        </div>
      </div>
      {nav}
      <div className="ml-auto flex items-center gap-2">
        {children}
        <CreateMenu compact className="md:hidden" />
      </div>
    </header>
  );
}

/** Zone défilante sous l'en-tête. */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto p-4 md:px-6", className)}>{children}</div>;
}
