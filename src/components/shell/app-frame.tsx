"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useState } from "react";

import { useApp } from "@/components/app-provider";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_COOKIE } from "@/lib/preferences";
import { cn } from "@/lib/utils";

import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { PLANNING_PATHS, PLANNING_VIEWS } from "./nav";
import { ShortcutsDialog } from "./shortcuts";

type ShellContextValue = {
  openCommand: () => void;
  openMobileNav: () => void;
  openShortcuts: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell doit être utilisé dans <AppFrame>");
  return value;
}

/** Vrai si la frappe vise un champ de saisie (les raccourcis à une lettre sont alors ignorés). */
function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Cadre de l'application : barre latérale, menu mobile, palette ⌘K et raccourcis clavier. */
export function AppFrame({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const { newPost } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState<{ open: boolean; pathname: string }>({
    open: false,
    pathname,
  });

  // Le menu mobile se ferme dès qu'on change de page.
  if (mobileNav.open && mobileNav.pathname !== pathname) setMobileNav({ open: false, pathname });

  // Le lien « Planning » ramène à la dernière vue ouverte, avec ses filtres.
  const [planningHref, setPlanningHref] = useState("/board");
  if (PLANNING_PATHS.includes(pathname)) {
    const search = searchParams.toString();
    const current = search ? `${pathname}?${search}` : pathname;
    if (current !== planningHref) setPlanningHref(current);
  }

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setCommandOpen((open) => !open);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    // Pas de raccourci quand une fenêtre (fiche d'un post, dialogue…) est ouverte.
    if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;

    if (e.key === "?") {
      e.preventDefault();
      setShortcutsOpen(true);
      return;
    }
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      newPost();
      return;
    }
    const view = PLANNING_VIEWS.find((v) => v.shortcut === e.key);
    if (view && PLANNING_PATHS.includes(pathname)) {
      e.preventDefault();
      const search = searchParams.toString();
      router.push(search ? `${view.href}?${search}` : view.href);
      return;
    }
    if (e.key === "/") {
      const input = document.querySelector<HTMLInputElement>("[data-page-search]");
      if (input) {
        e.preventDefault();
        input.focus();
      }
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const shell = useMemo(
    () => ({
      openCommand: () => setCommandOpen(true),
      openMobileNav: () => setMobileNav({ open: true, pathname }),
      openShortcuts: () => setShortcutsOpen(true),
    }),
    [pathname],
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className="flex h-full">
        <aside
          className={cn(
            "shrink-0 border-r transition-[width] duration-200 max-md:hidden",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <AppSidebar
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            onOpenCommand={shell.openCommand}
            planningHref={planningHref}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>

      <Sheet open={mobileNav.open} onOpenChange={(open) => setMobileNav({ open, pathname })}>
        <SheetContent side="left" showClose={false} className="w-72">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar
            collapsed={false}
            onOpenCommand={() => {
              setMobileNav({ open: false, pathname });
              setCommandOpen(true);
            }}
            planningHref={planningHref}
          />
        </SheetContent>
      </Sheet>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} onShowShortcuts={() => setShortcutsOpen(true)} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </ShellContext.Provider>
  );
}
