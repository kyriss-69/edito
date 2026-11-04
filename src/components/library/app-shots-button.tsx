"use client";

import { AlertTriangle, Camera, Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppShotsEvent, AppShotsInfo } from "@/lib/app-shots";

type Row = { status: "pending" | "ok" | "error"; error?: string };

/** Refait la planche de captures de l'app (lancée en local) et la range dans la médiathèque. */
export function AppShotsButton({ config }: { config: AppShotsInfo }) {
  const shots = config.shots;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  async function run() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setError(null);
    setRows(Object.fromEntries(shots.map((s) => [s.key, { status: "pending" }])));
    try {
      const res = await fetch("/api/web/app-shots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      if (!res.body) throw new Error("Pas de réponse");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AppShotsEvent;
          if (event.type === "shot") {
            setRows((prev) => ({
              ...prev,
              [event.key]: event.ok ? { status: "ok" } : { status: "error", error: event.error },
            }));
          } else if (event.type === "error") {
            setError(event.message);
          } else if (event.type === "done") {
            if (event.failed) toast.warning(`${event.saved} écrans capturés, ${event.failed} en échec`);
            else toast.success(`${event.saved} écrans de l'app capturés`);
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Les captures ont échoué.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  function close() {
    controllerRef.current?.abort();
    setOpen(false);
  }

  const done = Object.values(rows).filter((r) => r.status !== "pending").length;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Camera /> Écrans de l&apos;app
      </Button>
      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
        <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Écrans de l&apos;app</DialogTitle>
            <DialogDescription>
              Capture {shots.length} écrans et blocs de {config.appName} (pages entières, cartes, téléphone) avec les
              comptes de test, et les range dans la catégorie « Écrans de l&apos;app ». Les anciennes
              captures sont remplacées : les slides qui les utilisent suivent.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>
              L&apos;app doit tourner sur <code className="text-foreground">{config.baseUrl}</code>.
            </p>
            {config.accounts.length > 0 && (
              <p>Comptes utilisés : {config.accounts.map((a) => a.label).join(", ")}.</p>
            )}
          </div>
          {error && (
            <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          {Object.keys(rows).length > 0 && (
            <ul className="min-h-0 flex-1 overflow-y-auto rounded-lg border text-sm">
              {shots.map((shot) => {
                const row = rows[shot.key];
                return (
                  <li key={shot.key} className="flex items-start gap-2 border-b px-3 py-1.5 last:border-b-0">
                    {row?.status === "ok" ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : row?.status === "error" ? (
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <Loader2 className={`mt-0.5 size-4 shrink-0 text-muted-foreground ${running ? "animate-spin" : ""}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      {shot.title}
                      {row?.error && <span className="block text-xs text-destructive">{row.error}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <DialogFooter className="items-center">
            {running && (
              <span className="mr-auto text-xs text-muted-foreground">
                {done} / {shots.length} · environ 2 minutes
              </span>
            )}
            <Button variant="outline" onClick={close}>
              {running ? "Arrêter" : "Fermer"}
            </Button>
            <Button onClick={() => void run()} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Camera />}
              {Object.keys(rows).length ? "Recommencer" : "Lancer les captures"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
