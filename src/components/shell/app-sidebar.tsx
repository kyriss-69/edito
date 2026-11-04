"use client";

import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useApp } from "@/components/app-provider";
import { ColorDot } from "@/components/posts/platform-badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Hint } from "@/components/ui/tooltip";
import { accountStatusOf } from "@/lib/accounts";
import { PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

import { CreateMenu } from "./create-menu";
import { isActive, NAV_BRAND, NAV_MAIN, NAV_SETTINGS, type NavItem } from "./nav";
import { ProductMark } from "./product-logo";
import { ThemeMenu } from "./theme-menu";
import { WorkspaceMenu } from "./workspace-menu";

type SidebarProps = {
  collapsed: boolean;
  /** Absent dans le menu mobile (toujours déplié). */
  onToggle?: () => void;
  onOpenCommand: () => void;
  /** Dernière vue du Planning ouverte (avec ses filtres). */
  planningHref: string;
};

function NavLink({
  item,
  href = item.href,
  collapsed,
  children,
}: {
  item: NavItem;
  href?: string;
  collapsed: boolean;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = isActive(item, pathname);
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && children}
    </Link>
  );
  return collapsed ? (
    <Hint label={item.label} side="right">
      {link}
    </Hint>
  ) : (
    link
  );
}

/** État des comptes réseaux, en pastilles à côté de « Réseaux sociaux ». */
function AccountDots() {
  const { meta } = useApp();
  const accounts = meta.accounts.filter((account) => account.status !== "unused");
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {accounts.map((account) => {
        const status = accountStatusOf(account.status);
        return (
          <span key={account.id} title={`${PLATFORMS[account.platform].label} : ${status.label.toLowerCase()}`}>
            <ColorDot color={status.color} className="size-1.5" />
          </span>
        );
      })}
    </span>
  );
}

export function AppSidebar({ collapsed, onToggle, onOpenCommand, planningHref }: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5 px-3", collapsed && "justify-center px-0")}>
        <ProductMark />
        {!collapsed && <WorkspaceMenu />}
      </div>

      <div className={cn("flex flex-col gap-1.5 px-2", collapsed && "items-center")}>
        {collapsed ? (
          <>
            <Hint label="Rechercher" shortcut="⌘K" side="right">
              <Button variant="ghost" size="icon" onClick={onOpenCommand} aria-label="Rechercher">
                <Search />
              </Button>
            </Hint>
            <CreateMenu compact />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onOpenCommand}
              className="flex h-8 items-center gap-2 rounded-md border bg-card px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent"
            >
              <Search className="size-4" />
              Rechercher…
              <Kbd className="ml-auto">⌘K</Kbd>
            </button>
            <CreateMenu />
          </>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-4" aria-label="Navigation principale">
        {NAV_MAIN.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            href={item.href === "/board" ? planningHref : undefined}
            collapsed={collapsed}
          />
        ))}
        {collapsed ? (
          <div className="mx-auto my-3 h-px w-6 bg-border" />
        ) : (
          <div className="px-2.5 pt-5 pb-1.5 text-xs font-medium text-muted-foreground">Marque</div>
        )}
        {NAV_BRAND.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed}>
            {item.href === "/brand/accounts" && <AccountDots />}
          </NavLink>
        ))}
      </nav>

      <div className={cn("flex items-center gap-1 border-t p-2", collapsed && "flex-col")}>
        <div className={cn("min-w-0 flex-1", collapsed && "w-full")}>
          <NavLink item={NAV_SETTINGS} collapsed={collapsed} />
        </div>
        <ThemeMenu />
        {onToggle && (
          <Hint label={collapsed ? "Déplier le menu" : "Replier le menu"} side="right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggle}
              aria-label={collapsed ? "Déplier le menu" : "Replier le menu"}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </Hint>
        )}
      </div>
    </div>
  );
}
