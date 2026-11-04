import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const nf = new Intl.NumberFormat("fr-FR");

/** Champ de formulaire : libellé, contrôle et aide éventuelle. */
export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Compteur de caractères, en rouge au-delà de la limite. */
export function CharCounter({ value, max }: { value: string; max: number }) {
  const length = value.length;
  return (
    <p
      className={cn(
        "text-right text-xs text-muted-foreground tabular-nums",
        length > max && "font-medium text-destructive",
      )}
    >
      {nf.format(length)} / {nf.format(max)}
      {length > max && " · trop long, raccourcis ce texte"}
    </p>
  );
}
