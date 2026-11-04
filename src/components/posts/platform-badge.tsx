import { PlatformIcon } from "@/components/icons/platform-icon";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Réseau d'un post : logo seul (compact) ou logo + nom. */
export function PlatformBadge({
  platform,
  compact = false,
  className,
}: {
  platform: PlatformId;
  compact?: boolean;
  className?: string;
}) {
  const config = PLATFORMS[platform];
  if (compact) {
    return (
      <span title={config.label} className={cn("inline-flex", className)}>
        <PlatformIcon platform={platform} colored className="size-3.5" />
        <span className="sr-only">{config.label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 text-xs leading-none font-medium",
        className,
      )}
    >
      <PlatformIcon platform={platform} colored className="size-3.5" />
      {config.label}
    </span>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
