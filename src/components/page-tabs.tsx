"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { segmentedItem, segmentedList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Onglets d'une page, sous forme de liens (une adresse par onglet). */
export function PageTabs({
  tabs,
  label,
  className,
}: {
  tabs: { href: string; label: string }[];
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav className={cn(segmentedList, "max-w-full overflow-x-auto", className)} aria-label={label}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={segmentedItem}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
