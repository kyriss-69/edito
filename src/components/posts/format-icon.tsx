import { CircleDashed, Clapperboard, GalleryHorizontal, Image, Radio, type LucideIcon } from "lucide-react";

import { formatLabel } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  image: Image,
  carousel: GalleryHorizontal,
  video: Clapperboard,
  story: CircleDashed,
  live: Radio,
};

/** Icône du format d'un post. */
export function FormatIcon({ format, className }: { format: string; className?: string }) {
  const Icon = ICONS[format] ?? Image;
  return <Icon role="img" aria-label={formatLabel(format)} className={cn("size-3.5 shrink-0", className)} />;
}
