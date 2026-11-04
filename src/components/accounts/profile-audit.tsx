"use client";

import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AiError, AiIcon, AiProgress } from "@/components/ai/ai-progress";
import { AssistantPanel, Proposal, useAiReady } from "@/components/ai/caption-assistant";
import { useAiTask } from "@/components/ai/use-ai-task";
import { useApp } from "@/components/app-provider";
import { useNow } from "@/components/use-now";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROFILE_RUBRIC, PROFILE_RUBRIC_TOTAL } from "@/lib/ai/profile-rubric";
import { PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

/** Ce que l'app sait de l'activité Instagram : dernier post publié et posts prévus. */
function useInstagramActivity() {
  const { meta, posts } = useApp();
  const kinds = new Map(meta.columns.map((c) => [c.id, c.kind]));
  const now = useNow();
  const instagram = posts.filter((p) => p.platforms.some((e) => e.platform === "instagram") && p.scheduledAt !== null);
  const published = instagram
    .filter((p) => kinds.get(p.columnId) === "published" && (p.scheduledAt ?? 0) <= now)
    .sort((a, b) => (b.scheduledAt ?? 0) - (a.scheduledAt ?? 0));
  const upcoming = instagram.filter((p) => (p.scheduledAt ?? 0) > now && (p.scheduledAt ?? 0) < now + 7 * DAY).length;
  const last = published[0]?.scheduledAt;
  return [
    last ? `dernier post publié il y a ${Math.max(0, Math.round((now - last) / DAY))} jour(s)` : "aucun post marqué comme publié dans l'app",
    `${upcoming} post(s) prévu(s) dans les 7 prochains jours`,
  ].join(" ; ");
}

/** Audit du profil Instagram sur 100, puis réécriture des parties qui perdent des points. */
export function ProfileAudit({
  handle,
  bio,
  bioLink,
  hasPhoto,
  onUseBio,
}: {
  handle: string;
  bio: string;
  bioLink: string;
  /** Une photo de profil est enregistrée dans la fiche. */
  hasPhoto: boolean;
  onUseBio: (bio: string) => void;
}) {
  const ready = useAiReady();
  const task = useAiTask("profileAudit");
  const activity = useInstagramActivity();
  const [open, setOpen] = useState(false);
  const [nameField, setNameField] = useState("");
  const [highlights, setHighlights] = useState("");
  const [pinned, setPinned] = useState("");
  const [notes, setNotes] = useState("");

  function run() {
    if (!ready()) return;
    const photo = hasPhoto ? "photo de profil ajoutée (le logo, d'après la fiche)" : "pas de photo de profil dans la fiche";
    void task.run({ handle, nameField, bio, bioLink, highlights, pinned, notes, activity: `${activity} ; ${photo}` });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Copié");
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <AiIcon /> Auditer le profil (note sur 100)
      </Button>
    );
  }

  const result = task.state.status === "done" ? task.state.result : null;
  const scores = result
    ? PROFILE_RUBRIC.map((item) => {
        const found = result.scores.find((s) => s.id === item.id);
        const score = Math.max(0, Math.min(item.points, Math.round(found?.score ?? 0)));
        return { ...item, score, comment: found?.comment ?? "Non évalué." };
      })
    : [];
  const total = scores.reduce((sum, s) => sum + s.score, 0);

  return (
    <AssistantPanel title="Audit du profil Instagram" onClose={close}>
      <p className="text-xs text-muted-foreground">
        Le profil est un écran de décision : on y arrive depuis un post et on a trois secondes pour savoir si la suite est
        pour nous. Complète ce que l&apos;app ne sait pas (regarde ton profil sur ton téléphone), la bio et le lien sont
        repris de la fiche.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-name" className="text-xs">Champ « Nom » (en gras)</Label>
          <Input id="audit-name" value={nameField} onChange={(e) => setNameField(e.target.value)} placeholder="Ma marque" className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-highlights" className="text-xs">Stories à la une</Label>
          <Input id="audit-highlights" value={highlights} onChange={(e) => setHighlights(e.target.value)} placeholder="Aucune, ou leurs noms" className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-pinned" className="text-xs">Posts épinglés</Label>
          <Input id="audit-pinned" value={pinned} onChange={(e) => setPinned(e.target.value)} placeholder="Aucun, ou leur sujet" className="h-8" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-notes" className="text-xs">Autres infos (facultatif)</Label>
          <Input id="audit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Compte pro, stories, grille…" className="h-8" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Activité vue par l&apos;app : {activity}.</p>
      {task.state.status !== "running" && (
        <Button size="sm" className="self-start" onClick={run}>
          {result ? <RefreshCw /> : <AiIcon />} {result ? "Refaire l'audit" : "Lancer l'audit"}
        </Button>
      )}
      {task.state.status === "running" && (
        <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={() => task.cancel()} />
      )}
      {task.state.status === "error" && <AiError message={task.state.error} onRetry={run} />}
      {result && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Note : <span className="text-lg font-semibold">{total}</span> / {PROFILE_RUBRIC_TOTAL}
          </p>
          <ul className="flex flex-col divide-y rounded-md border text-sm">
            {scores
              .slice()
              .sort((a, b) => b.points - b.score - (a.points - a.score))
              .map((s) => (
                <li key={s.id} className="flex gap-3 px-2.5 py-1.5">
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right font-medium tabular-nums",
                      s.score < s.points / 2 ? "text-destructive" : s.score < s.points ? "text-warning" : "text-success",
                    )}
                  >
                    {s.score}/{s.points}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">{s.comment}</span>
                  </span>
                </li>
              ))}
          </ul>
          {result.priorities.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">À corriger d&apos;abord</h4>
              <ol className="list-decimal pl-5 text-sm">
                {result.priorities.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ol>
            </div>
          )}
          {result.nameOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Champ « Nom »</h4>
              {result.nameOptions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => void copy(name)}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span>{name}</span>
                  <span className={cn("flex items-center gap-1 text-xs", [...name].length > 30 ? "text-destructive" : "text-muted-foreground")}>
                    {[...name].length}/30 <Copy className="size-3.5" />
                  </span>
                </button>
              ))}
            </div>
          )}
          {result.bioOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Bios</h4>
              {result.bioOptions.map((option, i) => (
                <Proposal
                  key={i}
                  text={option}
                  limit={PLATFORMS.instagram.bioLimit}
                  actionLabel="Utiliser"
                  onUse={() => {
                    onUseBio(option);
                    toast.success("Bio reprise dans la fiche : pense à enregistrer");
                  }}
                />
              ))}
            </div>
          )}
          {result.highlightNames.length > 0 && (
            <p className="text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Stories à la une : </span>
              {result.highlightNames.join(" · ")}
            </p>
          )}
        </div>
      )}
    </AssistantPanel>
  );
}
