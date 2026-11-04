"use client";

import { Copy, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandColorPicker } from "@/components/studio/brand-color-picker";
import { type BrandColor, type BrandKit } from "@/lib/brand";
import { BLANK_BACKGROUND, DEFAULT_TEXT_COLOR, DEFAULT_TITLE_TRACKING } from "@/lib/carousel";
import { resolveSlideFonts } from "@/lib/slide-fonts";
import { cn } from "@/lib/utils";
import { saveBrandKit } from "@/server/actions";

import { AssetThumb } from "./asset-thumb";

const HEX = /^#[0-9a-f]{6}$/i;

async function copyHex(hex: string) {
  await navigator.clipboard.writeText(hex.toUpperCase());
  toast.success(`${hex.toUpperCase()} copié`);
}

function Card({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ColorRow({
  color,
  onChange,
  onRemove,
}: {
  color: BrandColor;
  onChange: (color: BrandColor) => void;
  onRemove: () => void;
}) {
  const [hexText, setHexText] = useState(color.hex);
  const [synced, setSynced] = useState(color.hex);
  if (synced !== color.hex) {
    setSynced(color.hex);
    setHexText(color.hex);
  }

  return (
    <li className="grid grid-cols-[2.5rem_1fr_6.5rem] items-center gap-2 sm:grid-cols-[2.5rem_9rem_6.5rem_1fr_4.5rem_auto]">
      <input
        type="color"
        value={color.hex}
        onChange={(e) => onChange({ ...color, hex: e.target.value.toUpperCase() })}
        className="size-10 cursor-pointer rounded-md border bg-transparent p-0.5"
        aria-label={`Couleur ${color.name}`}
      />
      <Input
        value={color.name}
        onChange={(e) => onChange({ ...color, name: e.target.value })}
        placeholder="Nom"
        className="h-9"
      />
      <div className="relative">
        <Input
          value={hexText}
          onChange={(e) => {
            const value = e.target.value.trim();
            setHexText(value);
            const normalized = value.startsWith("#") ? value : `#${value}`;
            if (HEX.test(normalized)) onChange({ ...color, hex: normalized.toUpperCase() });
          }}
          onBlur={() => setHexText(color.hex)}
          className="h-9 pr-8 font-mono text-xs uppercase"
          aria-label="Code hexadécimal"
        />
        <button
          type="button"
          onClick={() => copyHex(color.hex)}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={`Copier ${color.hex}`}
          title="Copier le code"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <Input
        value={color.role}
        onChange={(e) => onChange({ ...color, role: e.target.value })}
        placeholder="Usage (fond, boutons, textes…)"
        className="col-span-2 h-9 sm:col-span-1"
      />
      <div className="relative">
        <Input
          type="number"
          min={0}
          max={100}
          value={color.share ?? ""}
          onChange={(e) =>
            onChange({
              ...color,
              share: e.target.value === "" ? null : Math.min(100, Math.max(0, Math.round(Number(e.target.value)))),
            })
          }
          placeholder="—"
          className="h-9 pr-6"
          aria-label="Part dans les visuels (%)"
          title="Part indicative dans les visuels"
        />
        <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Retirer la couleur">
        <X />
      </Button>
    </li>
  );
}

function PalettePreview({ colors }: { colors: BrandColor[] }) {
  const withShare = colors.filter((c) => c.share);
  const total = withShare.reduce((sum, c) => sum + (c.share ?? 0), 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {colors.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => copyHex(c.hex)}
            title={`${c.name} · ${c.hex} (cliquer pour copier)`}
            className="flex h-16 flex-1 items-end rounded-lg border p-1.5 text-left"
            style={{ backgroundColor: c.hex }}
          >
            <span className="rounded bg-white/80 px-1 font-mono text-[10px] text-black">{c.hex}</span>
          </button>
        ))}
      </div>
      {total > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex h-3 overflow-hidden rounded-full border">
            {withShare.map((c, i) => (
              <div key={i} style={{ backgroundColor: c.hex, flexGrow: c.share ?? 0 }} title={`${c.name} : ${c.share} %`} />
            ))}
          </div>
          <span className={cn("text-xs text-muted-foreground", total !== 100 && "text-destructive")}>
            Répartition dans les visuels : {total} %{total !== 100 && " (le total devrait faire 100 %)"}
          </span>
        </div>
      )}
    </div>
  );
}

export function BrandKitForm() {
  const { meta } = useApp();
  const [kit, setKit] = useState<BrandKit>(meta.brand);
  const [synced, setSynced] = useState(meta.brand);
  if (synced !== meta.brand) {
    setSynced(meta.brand);
    setKit(meta.brand);
  }
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(kit) !== JSON.stringify(meta.brand);
  // Logos d'abord, puis les autres visuels de marque, dans l'ordre d'ajout.
  const brandAssets = meta.library
    .filter((a) => a.category === "logo" || a.category === "brand")
    .sort((a, b) => Number(a.category !== "logo") - Number(b.category !== "logo") || a.id - b.id);

  // Mêmes polices que les slides du Studio (celles fournies avec l'app, sinon celles de l'ordinateur).
  const fonts = resolveSlideFonts(kit, (name) => `var(${name})`);
  const setStudio = <K extends keyof BrandKit["studio"]>(key: K, value: BrandKit["studio"][K]) =>
    setKit((prev) => ({ ...prev, studio: { ...prev.studio, [key]: value } }));

  const updatePalette = (index: number, palette: BrandKit["palettes"][number]) =>
    setKit((prev) => ({ ...prev, palettes: prev.palettes.map((p, i) => (i === index ? palette : p)) }));

  function save() {
    startTransition(async () => {
      const result = await saveBrandKit(kit);
      if (result.ok) toast.success("Charte enregistrée");
      else toast.error(result.error);
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 pb-20">
      <Card
        title="Logo et visuels de marque"
        description="Les fichiers des catégories « Logos » et « Charte & identité » de la médiathèque."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/brand/media">Gérer les médias</Link>
          </Button>
        }
      >
        {brandAssets.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brandAssets.map((asset) => (
              <li key={asset.id} className="overflow-hidden rounded-lg border">
                <a href={asset.url} target="_blank" rel="noreferrer" title="Ouvrir en grand">
                  <AssetThumb asset={asset} className="aspect-video w-full" />
                </a>
                <p className="truncate px-2 py-1.5 text-xs font-medium">{asset.title}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun logo pour le moment.</p>
        )}
      </Card>

      <Card title="Identité" description="Repris par l'assistant IA dans toutes ses propositions.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-slogan">Slogan</Label>
            <Input
              id="brand-slogan"
              value={kit.slogan}
              onChange={(e) => setKit((prev) => ({ ...prev, slogan: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-positioning">Positionnement</Label>
            <Input
              id="brand-positioning"
              value={kit.positioning}
              onChange={(e) => setKit((prev) => ({ ...prev, positioning: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {kit.palettes.map((palette, index) => (
        <Card
          key={index}
          title={palette.name || "Palette"}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() =>
                setKit((prev) => ({ ...prev, palettes: prev.palettes.filter((_, i) => i !== index) }))
              }
            >
              <Trash2 /> Supprimer la palette
            </Button>
          }
        >
          <div className="flex flex-col gap-1.5 sm:w-72">
            <Label htmlFor={`palette-${index}`} className="text-xs text-muted-foreground">
              Nom de la palette
            </Label>
            <Input
              id={`palette-${index}`}
              value={palette.name}
              onChange={(e) => updatePalette(index, { ...palette, name: e.target.value })}
              className="h-9"
            />
          </div>
          <PalettePreview colors={palette.colors} />
          <ul className="flex flex-col gap-2">
            {palette.colors.map((color, colorIndex) => (
              <ColorRow
                key={colorIndex}
                color={color}
                onChange={(next) =>
                  updatePalette(index, {
                    ...palette,
                    colors: palette.colors.map((c, i) => (i === colorIndex ? next : c)),
                  })
                }
                onRemove={() =>
                  updatePalette(index, {
                    ...palette,
                    colors: palette.colors.filter((_, i) => i !== colorIndex),
                  })
                }
              />
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              updatePalette(index, {
                ...palette,
                colors: [...palette.colors, { name: "", hex: "#CCCCCC", role: "", share: null }],
              })
            }
            disabled={palette.colors.length >= 20}
          >
            <Plus /> Ajouter une couleur
          </Button>
        </Card>
      ))}
      <Button
        variant="outline"
        className="self-start"
        onClick={() =>
          setKit((prev) => ({
            ...prev,
            palettes: [...prev.palettes, { name: "Nouvelle palette", colors: [] }],
          }))
        }
        disabled={kit.palettes.length >= 6}
      >
        <Plus /> Ajouter une palette
      </Button>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Dégradé" description="Utilisé dans le K du logo.">
          <div
            className="h-12 rounded-lg border"
            style={{
              background:
                kit.gradient.length > 1
                  ? `linear-gradient(90deg, ${kit.gradient.join(", ")})`
                  : (kit.gradient[0] ?? "transparent"),
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {kit.gradient.map((stop, i) => (
              <div key={i} className="flex items-center gap-1 rounded-md border p-1">
                <input
                  type="color"
                  value={stop}
                  onChange={(e) =>
                    setKit((prev) => ({
                      ...prev,
                      gradient: prev.gradient.map((g, j) => (j === i ? e.target.value.toUpperCase() : g)),
                    }))
                  }
                  className="size-7 cursor-pointer rounded bg-transparent"
                  aria-label={`Couleur ${i + 1} du dégradé`}
                />
                <span className="font-mono text-xs">{stop}</span>
                <button
                  type="button"
                  onClick={() => setKit((prev) => ({ ...prev, gradient: prev.gradient.filter((_, j) => j !== i) }))}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Retirer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {kit.gradient.length < 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setKit((prev) => ({ ...prev, gradient: [...prev.gradient, "#CCCCCC"] }))}
              >
                <Plus /> Couleur
              </Button>
            )}
          </div>
        </Card>

        <Card title="Typographie">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["heading", "Police des titres"],
                ["headingFallback", "Substitut"],
                ["body", "Police des textes"],
                ["bodyFallback", "Substitut"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={`font-${key}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <Input
                  id={`font-${key}`}
                  value={kit.fonts[key]}
                  onChange={(e) => setKit((prev) => ({ ...prev, fonts: { ...prev.fonts, [key]: e.target.value } }))}
                  className="h-9"
                />
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xl" style={{ fontFamily: fonts.heading, fontWeight: fonts.headingWeight }}>
              {kit.slogan || "Titre d'exemple"}
            </p>
            <p className="text-sm" style={{ fontFamily: fonts.body, fontWeight: fonts.bodyWeight }}>
              {kit.positioning || "Texte d'exemple pour les légendes et les visuels."}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Outfit, Plus Jakarta Sans, Inter et Inter Tight sont fournies avec l&apos;app (aussi dans le
              Studio) ; les autres polices doivent être installées sur ton ordinateur.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Studio carrousel"
        description="Couleurs et titres proposés aux nouveaux carrousels (modifiables ensuite dans chaque carrousel)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <BrandColorPicker
            label="Fond (sans mockup)"
            value={kit.studio.background}
            onChange={(hex) => setStudio("background", hex)}
            sameLabel="Par défaut"
            sameColor={BLANK_BACKGROUND}
          />
          <BrandColorPicker
            label="Titres"
            value={kit.studio.title}
            onChange={(hex) => setStudio("title", hex)}
            sameLabel="Comme le texte"
            sameColor={kit.studio.text ?? DEFAULT_TEXT_COLOR}
          />
          <BrandColorPicker
            label="Texte"
            value={kit.studio.text}
            onChange={(hex) => setStudio("text", hex)}
            sameLabel="Par défaut"
            sameColor={DEFAULT_TEXT_COLOR}
          />
          <BrandColorPicker
            label="Mots mis en avant (*entre astérisques* dans un titre)"
            value={kit.studio.accent}
            onChange={(hex) => setStudio("accent", hex)}
            sameLabel="Comme le titre"
            sameColor={kit.studio.title ?? kit.studio.text ?? DEFAULT_TEXT_COLOR}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="studio-tracking" className="text-xs text-muted-foreground">
              Espacement des lettres des titres (em, négatif = resserré)
            </Label>
            <Input
              id="studio-tracking"
              type="number"
              step={0.005}
              min={-0.1}
              max={0.1}
              value={kit.studio.titleTracking ?? DEFAULT_TITLE_TRACKING}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value)) setStudio("titleTracking", Math.min(0.1, Math.max(-0.1, value)));
              }}
              className="h-9 w-32"
            />
          </div>
          <BrandColorPicker
            label="Haut du fond en dégradé (vers le fond)"
            value={kit.studio.gradientTop}
            onChange={(hex) => setStudio("gradientTop", hex)}
            sameLabel="Fond uni"
            sameColor={kit.studio.background ?? BLANK_BACKGROUND}
          />
          {(["Halo en haut à gauche", "Halo en bas à droite"] as const).map((label, i) => (
            <BrandColorPicker
              key={label}
              label={label}
              value={kit.studio.halos[i] ?? null}
              onChange={(hex) => {
                const halos = [...kit.studio.halos];
                if (hex) halos[i] = hex;
                else halos.splice(i);
                setStudio("halos", halos.filter(Boolean).slice(0, 2));
              }}
              sameLabel="Aucun"
              sameColor={kit.studio.background ?? BLANK_BACKGROUND}
            />
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="studio-footer" className="text-xs text-muted-foreground">
              Pied de slide (en bas à gauche)
            </Label>
            <Input
              id="studio-footer"
              value={kit.studio.footer}
              onChange={(e) => setStudio("footer", e.target.value.slice(0, 80))}
              placeholder="Ex. : @tamarque · nom de la série"
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={kit.studio.pagination}
                onCheckedChange={(v) => setStudio("pagination", v === true)}
              />
              Points de pagination (point actif en couleur d&apos;accent)
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={kit.studio.kickers} onCheckedChange={(v) => setStudio("kickers", v === true)} />
              Kicker et note de source sur chaque slide (écrits aussi par l&apos;assistant)
            </label>
          </div>
        </div>
      </Card>

      <Card
        title="Règles d'utilisation"
        description="Zone de protection, ce qu'il faut faire ou éviter… Une règle par ligne."
      >
        <Textarea
          value={kit.guidelines}
          onChange={(e) => setKit((prev) => ({ ...prev, guidelines: e.target.value }))}
          className="min-h-40"
          aria-label="Règles d'utilisation"
        />
      </Card>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <Button variant="ghost" size="sm" className="mr-auto" onClick={() => setConfirmReset(true)}>
          <RotateCcw /> Rétablir la charte par défaut
        </Button>
        {dirty && <span className="text-xs text-muted-foreground">Modifications non enregistrées</span>}
        <Button onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          Enregistrer la charte
        </Button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Rétablir la charte par défaut ?"
        description="Les couleurs, polices et règles reviennent aux valeurs d'origine (il faudra ensuite enregistrer)."
        confirmLabel="Rétablir"
        destructive={false}
        onConfirm={() => setKit(meta.workspace.brandKit)}
      />
    </div>
  );
}
