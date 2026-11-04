"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** État de l'enregistrement automatique, dans l'en-tête d'un éditeur. */
export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
      >
        <AlertCircle className="size-3.5" /> Non enregistré · réessayer
      </button>
    );
  }
  if (status === "idle") return <span className="text-xs text-muted-foreground max-sm:hidden">Brouillon</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
      {status === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      <span className="max-sm:hidden">{status === "saving" ? "Enregistrement…" : "Enregistré"}</span>
    </span>
  );
}
