"use client";

import { PlatformIcon } from "@/components/icons/platform-icon";
import { PLATFORM_IDS, PLATFORMS, type PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/** Choix des réseaux en pastilles (logo + nom), dans l'ordre habituel. */
export function PlatformToggles({
  value,
  onChange,
  choices,
  className,
}: {
  value: readonly PlatformId[];
  onChange: (platforms: PlatformId[]) => void;
  /** Réseaux proposés (en général ceux utilisés par la marque). */
  choices: readonly PlatformId[];
  className?: string;
}) {
  const toggle = (platform: PlatformId) =>
    onChange(
      value.includes(platform)
        ? value.filter((p) => p !== platform)
        : PLATFORM_IDS.filter((p) => p === platform || value.includes(p)),
    );

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {choices.map((id) => {
        const selected = value.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(id)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
              selected ? "border-primary/40 bg-primary/10 text-foreground" : "bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <PlatformIcon platform={id} colored={selected} className="size-3.5" />
            {PLATFORMS[id].label}
          </button>
        );
      })}
    </div>
  );
}
