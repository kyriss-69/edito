"use client";

import { Check, Circle, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { onboardingSteps } from "@/lib/onboarding";
import { PRODUCT } from "@/lib/product";
import { cn } from "@/lib/utils";
import { saveUiPreferences } from "@/server/actions";

/** « Bien démarrer » : les premières étapes, cochées au fur et à mesure. */
export function GettingStarted() {
  const { meta, posts, newPost } = useApp();
  const steps = onboardingSteps(meta, posts);
  const done = steps.filter((s) => s.done).length;
  if (meta.ui.onboardingDismissed || done === steps.length) return null;

  function dismiss() {
    void saveUiPreferences({ onboardingDismissed: true }).then((result) => {
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 lg:col-span-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Bien démarrer avec {PRODUCT.name}</h2>
          <p className="text-xs text-muted-foreground">
            {done} étape{done > 1 ? "s" : ""} sur {steps.length} · quelques minutes pour tout mettre en place.
          </p>
        </div>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted max-sm:hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Masquer « Bien démarrer »">
          <X />
        </Button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => {
          const content = (
            <>
              {step.done ? (
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
              )}
              <span className="min-w-0">
                <span className={cn("block text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                  {step.label}
                </span>
                <span className="block text-xs text-muted-foreground">{step.description}</span>
              </span>
            </>
          );
          const className = cn(
            "flex h-full w-full items-start gap-2.5 rounded-lg border bg-card p-3 text-left transition-colors",
            !step.done && "hover:border-primary/40 hover:bg-accent",
          );
          return (
            <li key={step.id}>
              {step.done ? (
                <div className={className}>{content}</div>
              ) : step.href ? (
                <Link href={step.href} className={className}>
                  {content}
                </Link>
              ) : (
                <button type="button" onClick={() => newPost()} className={className}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
