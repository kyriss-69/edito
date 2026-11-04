"use client";

import { Globe, Loader2, RefreshCw, Save, ScanSearch, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { AiError, AiProgress } from "@/components/ai/ai-progress";
import { useAiReady } from "@/components/ai/caption-assistant";
import { readNdjson, responseError } from "@/components/ai/ndjson";
import type { AiPhase } from "@/components/ai/use-ai-task";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { CharCounter } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SITE_SUMMARY_MAX, type SiteNotes } from "@/lib/ai/site";
import { displayUrl, normalizeUrl } from "@/lib/web";
import { saveAiSettings, saveSiteSummary } from "@/server/actions";

type SiteEvent =
  | { type: "step"; label: string }
  | { type: "progress"; phase: AiPhase; chars: number }
  | { type: "result"; data: SiteNotes }
  | { type: "error"; message: string };

type Run =
  | { status: "idle" }
  | { status: "running"; label: string; phase: AiPhase | null; startedAt: number }
  | { status: "error"; message: string };

/**
 * Analyse du site de la marque : l'assistant lit les pages principales et en
 * tire un résumé (messages, offre, vocabulaire), envoyé avec chaque demande.
 */
export function SiteAnalysis() {
  const { meta } = useApp();
  const router = useRouter();
  const ready = useAiReady();
  const site = meta.site;
  const [url, setUrl] = useState(site.url || meta.ai.web.siteUrl);
  const [summary, setSummary] = useState(site.summary);
  const [synced, setSynced] = useState(site.summary);
  if (synced !== site.summary) {
    setSynced(site.summary);
    setSummary(site.summary);
  }
  const [run, setRun] = useState<Run>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const controllerRef = useRef<AbortController | null>(null);
  const dirty = summary !== site.summary;

  async function analyze() {
    const target = normalizeUrl(url);
    if (!target) {
      toast.error("Adresse invalide (ex. tamarque.fr).");
      return;
    }
    if (!ready()) return;
    if (normalizeUrl(meta.ai.web.siteUrl) !== target) {
      void saveAiSettings({ ...meta.ai, web: { ...meta.ai.web, siteUrl: target } });
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = Date.now();
    setRun({ status: "running", label: "Ouverture du site…", phase: null, startedAt });
    try {
      const res = await fetch("/api/ai/site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
        signal: controller.signal,
      });
      if (!res.ok) {
        setRun({ status: "error", message: await responseError(res, "L'analyse a échoué.") });
        return;
      }
      let finished = false;
      await readNdjson<SiteEvent>(res, (event) => {
        if (event.type === "step") setRun({ status: "running", label: event.label, phase: null, startedAt });
        else if (event.type === "progress")
          setRun((prev) => (prev.status === "running" ? { ...prev, phase: event.phase } : prev));
        else if (event.type === "error") {
          finished = true;
          setRun({ status: "error", message: event.message });
        } else {
          finished = true;
          setRun({ status: "idle" });
          setSummary(event.data.summary);
          toast.success("Site analysé : le résumé est maintenant envoyé à l'assistant");
          router.refresh();
        }
      });
      if (!finished) setRun({ status: "error", message: "La connexion a été interrompue." });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") setRun({ status: "idle" });
      else setRun({ status: "error", message: "Impossible de lancer l'analyse." });
    } finally {
      controllerRef.current = null;
    }
  }

  function save(value: string) {
    startTransition(async () => {
      const result = await saveSiteSummary(value);
      if (!result.ok) toast.error(result.error);
      else toast.success(value.trim() ? "Résumé du site enregistré" : "Résumé du site effacé");
    });
  }

  const running = run.status === "running";

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Globe className="size-4 text-muted-foreground" /> Site web
        </h2>
        <p className="text-sm text-muted-foreground">
          L&apos;assistant lit les pages principales du site et en garde un résumé (messages clés, offre, vocabulaire,
          appels à l&apos;action), envoyé avec chaque demande pour que les posts parlent comme le site.
        </p>
      </div>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="tamarque.fr"
          aria-label="Adresse du site"
          disabled={running}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void analyze();
            }
          }}
        />
        <Button variant="outline" onClick={() => void analyze()} disabled={running || !url.trim()}>
          {running ? <Loader2 className="animate-spin" /> : site.summary ? <RefreshCw /> : <ScanSearch />}
          {site.summary ? "Analyser à nouveau" : "Analyser le site"}
        </Button>
      </div>

      {run.status === "running" &&
        (run.phase ? (
          <AiProgress phase={run.phase} startedAt={run.startedAt} onCancel={() => controllerRef.current?.abort()} />
        ) : (
          <div role="status" className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" />
            <span className="truncate">{run.label}</span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => controllerRef.current?.abort()}>
              Annuler
            </Button>
          </div>
        ))}
      {run.status === "error" && <AiError message={run.message} onRetry={() => void analyze()} />}

      {(site.summary || summary) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Résumé envoyé à l&apos;assistant
              {site.analyzedAt &&
                ` · analysé le ${new Date(site.analyzedAt).toLocaleDateString("fr-FR", { dateStyle: "long" })}`}
              {site.pages.length > 0 && ` · ${site.pages.length} page(s) lue(s)`}
            </span>
            <span>Tu peux le corriger ou le compléter.</span>
          </div>
          <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-48 text-sm" />
          <CharCounter value={summary} max={SITE_SUMMARY_MAX} />
          {site.pages.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {site.pages.map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noreferrer"
                    title={page.title}
                    className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {displayUrl(page.url)}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end gap-2">
            {site.summary && (
              <Button variant="ghost" size="sm" onClick={() => save("")} disabled={pending || running}>
                <Trash2 /> Effacer
              </Button>
            )}
            {dirty && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setSummary(site.summary)} disabled={pending}>
                  Annuler
                </Button>
                <Button size="sm" onClick={() => save(summary)} disabled={pending || summary.length > SITE_SUMMARY_MAX}>
                  {pending ? <Loader2 className="animate-spin" /> : <Save />} Enregistrer
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
