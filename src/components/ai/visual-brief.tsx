"use client";

import { Copy, NotebookPen, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Draft } from "@/components/posts/post-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLabel } from "@/lib/platforms";

import { AiError, AiIcon, AiProgress } from "./ai-progress";
import { AssistantPanel, useAiReady, usePostContext } from "./caption-assistant";
import { useAiTask } from "./use-ai-task";

/** Génère le brief du visuel (image, carrousel, vidéo…) d'après la charte graphique. */
export function VisualBriefAssistant({
  draft,
  onAppend,
}: {
  draft: Draft;
  onAppend: (brief: string) => void;
}) {
  const post = usePostContext(draft);
  const ready = useAiReady();
  const task = useAiTask("visualBrief");
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");

  function generate() {
    if (!ready()) return;
    setOpen(true);
    void task.run({ post, instruction });
  }

  function close() {
    task.cancel();
    setOpen(false);
  }

  const brief = task.state.status === "done" ? task.state.result.brief : "";

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={generate}
        title="Idée, textes, déroulé, couleurs et polices de la charte"
      >
        <AiIcon /> Brief du visuel · {formatLabel(draft.format)}
      </Button>
      {open && (
        <AssistantPanel title="Brief du visuel, d'après la charte" onClose={close}>
          {task.state.status === "running" && (
            <AiProgress phase={task.state.phase} startedAt={task.state.startedAt} onCancel={close} />
          )}
          {task.state.status === "error" && <AiError message={task.state.error} onRetry={generate} />}
          {task.state.status === "done" && (
            <>
              <div className="rounded-md border bg-card p-3 text-sm whitespace-pre-wrap">{brief}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onAppend(`BRIEF DU VISUEL\n${brief}`);
                    toast.success("Brief ajouté aux notes");
                    close();
                  }}
                >
                  <NotebookPen /> Ajouter aux notes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(brief);
                    toast.success("Brief copié");
                  }}
                >
                  <Copy /> Copier
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      generate();
                    }
                  }}
                  placeholder="Affiner (optionnel) : plus minimaliste, 5 slides, tourné au smartphone…"
                  className="h-8"
                />
                <Button size="sm" variant="outline" onClick={generate}>
                  <RefreshCw /> Relancer
                </Button>
              </div>
            </>
          )}
        </AssistantPanel>
      )}
    </div>
  );
}
