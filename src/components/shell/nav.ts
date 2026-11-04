import {
  AtSign,
  House,
  CalendarDays,
  GalleryHorizontalEnd,
  Images,
  KanbanSquare,
  LayoutTemplate,
  List,
  MessagesSquare,
  Palette,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Adresses pour lesquelles l'entrée est active (par défaut : `href` et ses sous-pages). */
  match?: string[];
  /** Adresses exactes seulement, sans leurs sous-pages. */
  exact?: boolean;
};

/** Les trois vues du Planning (mêmes posts, mêmes filtres). */
export const PLANNING_VIEWS = [
  { href: "/board", label: "Tableau", icon: KanbanSquare, shortcut: "1" },
  { href: "/calendar", label: "Calendrier", icon: CalendarDays, shortcut: "2" },
  { href: "/list", label: "Liste", icon: List, shortcut: "3" },
] as const;

export const PLANNING_PATHS: readonly string[] = PLANNING_VIEWS.map((v) => v.href);

export const NAV_MAIN: NavItem[] = [
  { href: "/home", label: "Accueil", icon: House },
  { href: "/board", label: "Planning", icon: KanbanSquare, match: [...PLANNING_PATHS] },
  { href: "/studio", label: "Studio", icon: GalleryHorizontalEnd },
  { href: "/assistant", label: "Assistant", icon: MessagesSquare },
];

export const NAV_BRAND: NavItem[] = [
  { href: "/brand", label: "Identité & charte", icon: Palette, match: ["/brand", "/brand/kit"], exact: true },
  { href: "/brand/media", label: "Médiathèque", icon: Images },
  {
    href: "/brand/templates",
    label: "Modèles & hashtags",
    icon: LayoutTemplate,
    match: ["/brand/templates", "/brand/hashtags"],
  },
  { href: "/brand/accounts", label: "Réseaux sociaux", icon: AtSign },
];

export const NAV_SETTINGS: NavItem = { href: "/settings", label: "Réglages", icon: Settings };

/** Sections des Réglages. */
export const SETTINGS_SECTIONS = [
  { href: "/settings", label: "Workflow" },
  { href: "/settings/ai", label: "Assistant IA" },
  { href: "/settings/preferences", label: "Préférences" },
  { href: "/settings/data", label: "Données" },
];

export function isActive(item: NavItem, pathname: string) {
  if (item.match) {
    return item.match.some((path) => pathname === path || (!item.exact && pathname.startsWith(`${path}/`)));
  }
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
