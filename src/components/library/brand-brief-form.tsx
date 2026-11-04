"use client";

import { AlertTriangle, CheckCircle2, FileText, Loader2, Save } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { CharCounter, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BRAND_DOC_MAX_CHARS, type BrandDocInfo } from "@/lib/ai/brand-doc";
import { BRAND_LIMITS, EMOJI_LEVELS, type BrandBrief } from "@/lib/ai/settings";
import { saveAiSettings } from "@/server/actions";

import { SiteAnalysis } from "./site-analysis";

const nf = new Intl.NumberFormat("fr-FR");

/** État du document de référence de l'espace (`brand/MARQUE.md`…), envoyé avec chaque demande. */
function BrandDocStatus({ info }: { info: BrandDocInfo }) {
  if (!info.found) {
    return (
      <div className="flex gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <FileText className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <p>
            Aucun fichier <code className="font-medium text-foreground">{info.path}</code> : l&apos;assistant
            n&apos;utilise que le brief ci-dessous. Place ce fichier dans le dossier du projet pour lui donner
            toutes les informations sur ta marque, puis recharge la page.
          </p>
          <p>
            Dossier cherché : <code className="break-all text-foreground">{info.folder}</code>
          </p>
          <p>
            Fichiers présents :{" "}
            {info.files.length ? (
              <code className="break-all text-foreground">{info.files.join(", ")}</code>
            ) : (
              "aucun (dossier vide ou introuvable)"
            )}
          </p>
        </div>
      </div>
    );
  }
  // Document + consignes + réponse (+ images pour l'analyse des médias).
  const minContext = Math.ceil((info.tokens + 4_000) / 1_024) * 1_024;
  const heavy = info.tokens > 3_000;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-success">
        <CheckCircle2 className="size-4" /> {info.path} est envoyé à l&apos;assistant à chaque demande
      </p>
      <p className="text-muted-foreground">
        Source de vérité : il fait foi sur le brief en cas de contradiction. {nf.format(info.chars)} caractères
        (≈ {nf.format(info.tokens)} tokens) · modifié le{" "}
        {new Date(info.updatedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}. Relu à
        chaque demande : tes modifications sont prises en compte tout de suite.
      </p>
      {info.truncated && (
        <p className="flex gap-1.5 font-medium text-destructive">
          <AlertTriangle className="size-4 shrink-0" /> Document trop long : seuls les{" "}
          {nf.format(BRAND_DOC_MAX_CHARS)} premiers caractères sont envoyés.
        </p>
      )}
      {heavy && (
        <p className="flex gap-1.5 text-warning">
          <AlertTriangle className="size-4 shrink-0" /> Document long : dans LM Studio, règle la longueur de
          contexte du modèle sur au moins {nf.format(minContext)} tokens.
        </p>
      )}
    </div>
  );
}

/** Brief de marque : ce que l'assistant IA sait de la marque (envoyé à chaque demande). */
export function BrandBriefForm() {
  const { meta } = useApp();
  const [brand, setBrand] = useState<BrandBrief>(meta.ai.brand);
  const [synced, setSynced] = useState(meta.ai.brand);
  if (synced !== meta.ai.brand) {
    setSynced(meta.ai.brand);
    setBrand(meta.ai.brand);
  }
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(brand) !== JSON.stringify(meta.ai.brand);

  const set = <K extends keyof BrandBrief>(key: K, value: BrandBrief[K]) =>
    setBrand((prev) => ({ ...prev, [key]: value }));

  function save() {
    startTransition(async () => {
      const result = await saveAiSettings({ ...meta.ai, brand });
      if (result.ok) toast.success("Brief de marque enregistré");
      else toast.error(result.error);
    });
  }

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col gap-4"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          save();
        }
      }}
    >
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Document de référence</h2>
          <p className="text-sm text-muted-foreground">
            Tout ce qu&apos;il faut savoir sur la marque, dans un fichier relu à chaque demande à l&apos;assistant.
          </p>
        </div>
        <BrandDocStatus info={meta.brandDoc} />
      </section>

      <SiteAnalysis />

      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">Brief de marque</h2>
          <p className="text-sm text-muted-foreground">
            Envoyé à chaque demande : plus il est précis, meilleurs sont les textes. Le nom de la marque est aussi
            celui de l&apos;espace de travail.
          </p>
        </div>
        <FormField label="Nom de la marque" htmlFor="brand-name">
          <Input id="brand-name" value={brand.name} onChange={(e) => set("name", e.target.value)} />
        </FormField>
        <FormField label="Ce qu'est la marque" htmlFor="brand-description">
          <Textarea
            id="brand-description"
            value={brand.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Notre application permet de… Ce qui la rend différente : …"
            className="min-h-24"
          />
          <CharCounter value={brand.description} max={BRAND_LIMITS.description} />
        </FormField>
        <FormField label="Public cible" htmlFor="brand-audience">
          <Textarea
            id="brand-audience"
            value={brand.audience}
            onChange={(e) => set("audience", e.target.value)}
            placeholder="Âge, métier, centres d'intérêt, problèmes qu'ils rencontrent…"
            className="min-h-16"
          />
          <CharCounter value={brand.audience} max={BRAND_LIMITS.audience} />
        </FormField>
        <FormField label="Style d'écriture" htmlFor="brand-style">
          <Textarea
            id="brand-style"
            value={brand.style}
            onChange={(e) => set("style", e.target.value)}
            placeholder="naturel, chaleureux et dynamique"
            className="min-h-10"
          />
          <CharCounter value={brand.style} max={BRAND_LIMITS.style} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="S'adresser à l'audience" htmlFor="brand-addressing">
            <Select value={brand.addressing} onValueChange={(v) => set("addressing", v as BrandBrief["addressing"])}>
              <SelectTrigger id="brand-addressing" className="w-full">
                <SelectValue>{brand.addressing === "tu" ? "Tutoiement" : "Vouvoiement"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tu">Tutoiement</SelectItem>
                <SelectItem value="vous">Vouvoiement</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Emojis" htmlFor="brand-emojis">
            <Select value={brand.emojis} onValueChange={(v) => set("emojis", v as BrandBrief["emojis"])}>
              <SelectTrigger id="brand-emojis" className="w-full">
                <SelectValue>{EMOJI_LEVELS.find((l) => l.id === brand.emojis)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EMOJI_LEVELS.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="À éviter" htmlFor="brand-avoid">
          <Textarea
            id="brand-avoid"
            value={brand.avoid}
            onChange={(e) => set("avoid", e.target.value)}
            placeholder="Ex. : jargon technique, promesses exagérées, le mot « révolutionnaire »"
            className="min-h-10"
          />
          <CharCounter value={brand.avoid} max={BRAND_LIMITS.avoid} />
        </FormField>
      </section>

      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 self-end rounded-xl border bg-popover p-2 pl-4 shadow-lg">
          <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>
          <Button variant="ghost" size="sm" onClick={() => setBrand(meta.ai.brand)} disabled={pending}>
            Annuler
          </Button>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
