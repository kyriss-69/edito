"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app-provider";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Choix d'une couleur parmi celles de la charte graphique (Bibliothèque →
 * Charte), avec leur nom, ou d'une couleur personnalisée.
 * `value = null` : « comme le texte » (si `sameLabel` est fourni).
 */
export function BrandColorPicker({
  label,
  value,
  onChange,
  sameLabel,
  sameColor,
}: {
  label: string;
  value: string | null;
  onChange: (hex: string | null) => void;
  /** Propose une option « même couleur que… » (valeur `null`). */
  sameLabel?: string;
  /** Couleur affichée pour l'option `null`. */
  sameColor?: string;
}) {
  const { meta } = useApp();
  const palettes = meta.brand.palettes.filter((p) => p.colors.length);
  const current = value?.toUpperCase() ?? null;
  const named = palettes.flatMap((p) => p.colors).find((c) => c.hex.toUpperCase() === current);
  const shown = current ?? sameColor ?? "#000000";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="size-3 rounded-full border" style={{ backgroundColor: shown }} />
          {current === null ? sameLabel : (named?.name ?? "Personnalisée")}
          <span className="font-mono text-muted-foreground">{shown.toUpperCase()}</span>
        </span>
      </div>

      {palettes.map((palette) => (
        <div key={palette.name} className="flex flex-col gap-1">
          {palettes.length > 1 && (
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {palette.name}
            </span>
          )}
          <div className="flex flex-wrap gap-1">
            {palette.colors.map((color) => (
              <Chip
                key={`${palette.name}-${color.hex}`}
                selected={current === color.hex.toUpperCase()}
                onClick={() => onChange(color.hex.toUpperCase())}
                swatch={color.hex}
                label={color.name || color.hex}
                title={[color.name, color.hex.toUpperCase(), color.role].filter(Boolean).join(" · ")}
              />
            ))}
          </div>
        </div>
      ))}
      {palettes.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Aucune couleur dans la charte : ajoute-les dans Bibliothèque → Charte.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {sameLabel && (
          <Chip
            selected={current === null}
            onClick={() => onChange(null)}
            swatch={sameColor ?? "#000000"}
            label={sameLabel}
            icon={<Link2 className="size-3" />}
          />
        )}
        <label
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-full border bg-card pr-1 pl-1 text-[11px]",
            current !== null && !named && "border-primary ring-1 ring-primary",
          )}
          title="Couleur personnalisée"
        >
          <input
            type="color"
            value={shown}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label={`${label} : couleur personnalisée`}
            className="size-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
          />
          <HexInput value={current ?? ""} onChange={onChange} label={`${label} : code couleur`} />
        </label>
      </div>
    </div>
  );
}

function Chip({
  selected,
  onClick,
  swatch,
  label,
  title,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  swatch: string;
  label: string;
  title?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-pressed={selected}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-full border bg-card pr-2.5 pl-1 text-[11px] transition-colors hover:bg-accent",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <span
        className="flex size-5 items-center justify-center rounded-full border"
        style={{ backgroundColor: swatch }}
      >
        {selected && <Check className="size-3 text-white mix-blend-difference" />}
      </span>
      {icon}
      {label}
    </button>
  );
}

/** Saisie d'un code couleur : appliqué dès qu'il est complet (#RRGGBB). */
function HexInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  return (
    <Input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const hex = e.target.value.trim();
        if (HEX.test(hex)) onChange(hex.toUpperCase());
      }}
      onBlur={() => setText(value)}
      placeholder="#RRGGBB"
      maxLength={7}
      className="h-5 w-[4.75rem] rounded-full border-0 bg-transparent px-1 font-mono text-[11px] shadow-none focus-visible:ring-0 dark:bg-transparent"
      aria-label={label}
    />
  );
}
