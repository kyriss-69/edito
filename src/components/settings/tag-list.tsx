"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAG_COLORS } from "@/lib/columns";
import type { TagDTO } from "@/lib/types";
import {
  createTag,
  deleteTag,
  reorderTags,
  updateTag,
  type SettingsKind,
} from "@/server/actions";



function TagRow({
  kind,
  tag,
  index,
  count,
  onMove,
  extra,
}: {
  kind: SettingsKind;
  tag: TagDTO;
  index: number;
  count: number;
  onMove: (index: number, delta: number) => void;
  /** Réglage supplémentaire affiché après le nom (ex. rôle d'une colonne). */
  extra?: React.ReactNode;
}) {
  const [name, setName] = useState(tag.name);
  const [confirm, setConfirm] = useState(false);
  const [, startTransition] = useTransition();

  function save(values: { name: string; color: string }) {
    if (values.name === tag.name && values.color === tag.color) return;
    startTransition(async () => {
      const result = await updateTag(kind, tag.id, values);
      if (!result.ok) {
        toast.error(result.error);
        setName(tag.name);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteTag(kind, tag.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        defaultValue={tag.color}
        onBlur={(e) => save({ name, color: e.target.value })}
        className="size-8 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
        aria-label="Couleur"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save({ name: name.trim(), color: tag.color })}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-8"
      />
      {extra}
      <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Monter">
        <ArrowUp />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label="Descendre">
        <ArrowDown />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={() => setConfirm(true)} aria-label="Supprimer">
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Supprimer « ${tag.name} » ?`}
        description={
          kind === "columns"
            ? "La colonne doit être vide pour pouvoir être supprimée."
            : "Les posts concernés n'auront plus cette étiquette."
        }
        confirmLabel="Supprimer"
        onConfirm={remove}
      />
    </li>
  );
}

export function TagList<T extends TagDTO>({
  kind,
  title,
  description,
  items,
  placeholder,
  renderExtra,
}: {
  kind: SettingsKind;
  title: string;
  description: string;
  items: T[];
  placeholder: string;
  renderExtra?: (item: T) => React.ReactNode;
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await createTag(kind, {
        name: name.trim(),
        color: TAG_COLORS[items.length % TAG_COLORS.length],
      });
      if (!result.ok) toast.error(result.error);
      else setName("");
    });
  }

  function move(index: number, delta: number) {
    const ids = items.map((i) => i.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    startTransition(() => reorderTags(kind, ids).then(() => undefined));
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((tag, index) => (
          // La clé inclut le nom pour réinitialiser le champ après un changement serveur.
          <TagRow
            key={`${tag.id}-${tag.name}-${tag.color}`}
            kind={kind}
            tag={tag}
            index={index}
            count={items.length}
            onMove={move}
            extra={renderExtra?.(tag)}
          />
        ))}
        {items.length === 0 && <li className="text-sm text-muted-foreground">Aucun élément.</li>}
      </ul>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={!name.trim() || pending}>
          <Plus /> Ajouter
        </Button>
      </div>
    </section>
  );
}
