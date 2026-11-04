"use client";

import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-FR");

export function StudioCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Choix exclusif sous forme de boutons accolés. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs font-medium transition-colors",
            value === option.id
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function RangeField({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "%",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="flex justify-between text-muted-foreground">
        {label}
        <span className="tabular-nums">
          {nf.format(value)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-primary"
      />
    </label>
  );
}

/** Compteur de caractères, en rouge au-delà de `max`. */
export function CharCount({ value, max, className }: { value: string; max: number; className?: string }) {
  const length = [...value].length;
  return (
    <span
      className={cn(
        "text-[11px] text-muted-foreground tabular-nums",
        length > max && "font-medium text-destructive",
        className,
      )}
    >
      {nf.format(length)} / {nf.format(max)}
    </span>
  );
}
