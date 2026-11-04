import { PRODUCT } from "@/lib/product";
import { cn } from "@/lib/utils";

/** Logo du produit : trois colonnes de hauteurs différentes, comme un tableau de contenus. */
export function ProductMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
        <rect x="4" y="5" width="4" height="14" rx="2" fill="currentColor" />
        <rect x="10" y="5" width="4" height="9" rx="2" fill="currentColor" opacity="0.75" />
        <rect x="16" y="5" width="4" height="11.5" rx="2" fill="currentColor" opacity="0.5" />
      </svg>
      <span className="sr-only">{PRODUCT.name}</span>
    </span>
  );
}
