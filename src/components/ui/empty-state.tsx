import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Écran vide : une invitation à agir plutôt qu'un simple « rien ici ». */
function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Actions (boutons). */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </span>
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export { EmptyState };
