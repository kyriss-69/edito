"use client";

import { FilePlus2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ChecklistSection } from "@/components/posts/checklist-section";
import { ColorDot, PlatformBadge } from "@/components/posts/platform-badge";
import { PlatformToggles } from "@/components/posts/platform-toggles";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultPostPlatforms, platformChoices } from "@/lib/accounts";
import { normalizeHashtags } from "@/lib/captions";
import { FORMATS, formatLabel } from "@/lib/platforms";
import type { TemplateDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteTemplate, saveTemplate, type TemplateInput } from "@/server/actions";

const NONE = "none";

export const EMPTY_TEMPLATE: TemplateInput = {
  name: "",
  description: "",
  title: "",
  caption: "",
  hashtags: "",
  cta: "",
  format: "image",
  platforms: [],
  pillarId: null,
  notes: "",
  checklist: [],
};

function toInput(t: TemplateDTO): TemplateInput {
  return {
    name: t.name,
    description: t.description,
    title: t.title,
    caption: t.caption,
    hashtags: t.hashtags,
    cta: t.cta,
    format: t.format,
    platforms: t.platforms,
    pillarId: t.pillarId,
    notes: t.notes,
    checklist: t.checklist,
  };
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Création ou modification d'un modèle de post. */
export function TemplateDialog({
  id,
  initial,
  onClose,
}: {
  id: number | null;
  initial: TemplateInput;
  onClose: () => void;
}) {
  const { meta } = useApp();
  const [form, setForm] = useState<TemplateInput>(initial);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof TemplateInput>(key: K, value: TemplateInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveTemplate(id, { ...form, hashtags: normalizeHashtags(form.hashtags) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(id === null ? "Modèle créé" : "Modèle enregistré");
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{id === null ? "Nouveau modèle" : "Modifier le modèle"}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom du modèle" htmlFor="tpl-name">
              <Input id="tpl-name" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </Field>
            <Field label="Description" htmlFor="tpl-description">
              <Input
                id="tpl-description"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="À quoi sert ce modèle"
              />
            </Field>
            <Field label="Titre du post" htmlFor="tpl-title" className="sm:col-span-2">
              <Input
                id="tpl-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex. : Astuce : [sujet]"
              />
            </Field>
            <Field label="Format" htmlFor="tpl-format">
              <Select value={form.format} onValueChange={(v) => set("format", v)}>
                <SelectTrigger id="tpl-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pilier de contenu" htmlFor="tpl-pillar">
              <Select
                value={form.pillarId === null || form.pillarId === undefined ? NONE : String(form.pillarId)}
                onValueChange={(v) => set("pillarId", v === NONE ? null : Number(v))}
              >
                <SelectTrigger id="tpl-pillar" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Aucun</SelectItem>
                  <SelectSeparator />
                  {meta.pillars.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      <ColorDot color={p.color} />
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Réseaux" className="sm:col-span-2">
              <PlatformToggles
                value={form.platforms}
                onChange={(platforms) => set("platforms", platforms)}
                choices={platformChoices(meta.accounts, form.platforms)}
              />
            </Field>
            <Field label="Légende (avec des [repères] à compléter)" htmlFor="tpl-caption" className="sm:col-span-2">
              <Textarea
                id="tpl-caption"
                value={form.caption}
                onChange={(e) => set("caption", e.target.value)}
                className="min-h-32"
              />
            </Field>
            <Field label="Hashtags" htmlFor="tpl-hashtags">
              <Input
                id="tpl-hashtags"
                value={form.hashtags}
                onChange={(e) => set("hashtags", e.target.value)}
                onBlur={(e) => set("hashtags", normalizeHashtags(e.target.value))}
              />
            </Field>
            <Field label="Appel à l'action" htmlFor="tpl-cta">
              <Input id="tpl-cta" value={form.cta} onChange={(e) => set("cta", e.target.value)} />
            </Field>
            <Field label="Notes" htmlFor="tpl-notes" className="sm:col-span-2">
              <Textarea
                id="tpl-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className="min-h-16"
              />
            </Field>
          </div>
          <div className="-mx-6 mt-4">
            <ChecklistSection
              items={form.checklist.map((label) => ({ label, done: false }))}
              onChange={(items) => set("checklist", items.map((i) => i.label))}
              checkable={false}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={pending || !form.name.trim()}>
            Enregistrer le modèle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesView() {
  const { meta, newPost } = useApp();
  const [editing, setEditing] = useState<{ id: number | null; initial: TemplateInput } | null>(null);
  const [deleting, setDeleting] = useState<TemplateDTO | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Des structures de posts réutilisables. « Utiliser » crée un nouveau post pré-rempli ; tu peux aussi enregistrer
          un post existant comme modèle depuis sa fiche.
        </p>
        <Button
          onClick={() =>
            setEditing({ id: null, initial: { ...EMPTY_TEMPLATE, platforms: defaultPostPlatforms(meta.accounts) } })
          }
        >
          <Plus /> Nouveau modèle
        </Button>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {meta.templates.map((t) => {
          const pillar = meta.pillars.find((p) => p.id === t.pillarId);
          return (
            <li key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div>
                <h2 className="font-semibold">{t.name}</h2>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {t.platforms.map((p) => (
                  <PlatformBadge key={p} platform={p} compact />
                ))}
                <Badge variant="outline" className="text-[10px]">
                  {formatLabel(t.format)}
                </Badge>
                {pillar && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ColorDot color={pillar.color} />
                    {pillar.name}
                  </span>
                )}
                {t.checklist.length > 0 && (
                  <span className="text-xs text-muted-foreground">· {t.checklist.length} étapes</span>
                )}
              </div>
              {t.caption && (
                <p className="line-clamp-4 rounded-md bg-muted/60 p-2 text-xs whitespace-pre-wrap">{t.caption}</p>
              )}
              <div className="mt-auto flex gap-2">
                <Button size="sm" onClick={() => newPost({ templateId: t.id })}>
                  <FilePlus2 /> Utiliser
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing({ id: t.id, initial: toInput(t) })}>
                  <Pencil /> Modifier
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setDeleting(t)}
                  aria-label={`Supprimer le modèle ${t.name}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {meta.templates.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">Aucun modèle pour le moment.</p>
      )}
      {editing && (
        <TemplateDialog id={editing.id} initial={editing.initial} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Supprimer le modèle « ${deleting?.name ?? ""} » ?`}
        description="Les posts déjà créés avec ce modèle ne sont pas touchés."
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (deleting) startTransition(() => deleteTemplate(deleting.id).then(() => undefined));
        }}
      />
    </div>
  );
}
