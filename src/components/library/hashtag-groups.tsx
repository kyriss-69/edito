"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeHashtags } from "@/lib/captions";
import type { HashtagGroupDTO } from "@/lib/types";
import { deleteHashtagGroup, saveHashtagGroup } from "@/server/actions";

function countTags(hashtags: string) {
  return hashtags.split(/\s+/).filter(Boolean).length;
}

function GroupCard({ group }: { group: HashtagGroupDTO }) {
  const [name, setName] = useState(group.name);
  const [hashtags, setHashtags] = useState(group.hashtags);
  const [confirm, setConfirm] = useState(false);
  const [, startTransition] = useTransition();

  function save(next: { name: string; hashtags: string }) {
    const normalized = { name: next.name.trim(), hashtags: normalizeHashtags(next.hashtags) };
    setHashtags(normalized.hashtags);
    if (normalized.name === group.name && normalized.hashtags === group.hashtags) return;
    startTransition(async () => {
      const result = await saveHashtagGroup(group.id, normalized);
      if (!result.ok) {
        toast.error(result.error);
        setName(group.name);
      }
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(hashtags);
    toast.success("Hashtags copiés");
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => save({ name, hashtags })}
          className="h-8 font-medium"
          aria-label="Nom du groupe"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{countTags(hashtags)} hashtags</span>
        <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copier les hashtags" title="Copier">
          <Copy />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => setConfirm(true)} aria-label="Supprimer le groupe">
          <Trash2 />
        </Button>
      </div>
      <Textarea
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        onBlur={() => save({ name, hashtags })}
        placeholder="#exemple #autre"
        className="min-h-16"
        aria-label={`Hashtags du groupe ${group.name}`}
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer le groupe « ${group.name} » ?`}
        confirmLabel="Supprimer"
        onConfirm={() => startTransition(() => deleteHashtagGroup(group.id).then(() => undefined))}
      />
    </li>
  );
}

export function HashtagGroups() {
  const { meta } = useApp();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await saveHashtagGroup(null, { name: name.trim(), hashtags: "" });
      if (result.ok) setName("");
      else toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Des listes de hashtags prêtes à l&apos;emploi : dans la fiche d&apos;un post, le bouton « Groupes » les ajoute en
        un clic. Les modifications sont enregistrées automatiquement.
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {meta.hashtagGroups.map((group) => (
          <GroupCard key={`${group.id}-${group.name}-${group.hashtags}`} group={group} />
        ))}
      </ul>
      <div className="flex max-w-md gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nom du nouveau groupe…"
          className="h-9"
        />
        <Button variant="outline" onClick={add} disabled={!name.trim() || pending}>
          <Plus /> Ajouter
        </Button>
      </div>
    </div>
  );
}
