"use client";

import { ChevronDown, ChevronUp, RotateCcw, ScanSearch } from "lucide-react";
import { useState } from "react";

import { useApp } from "@/components/app-provider";
import { AssetThumb } from "@/components/library/asset-thumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_CAROUSEL_STYLE,
  DEFAULT_TEXT_COLOR,
  TEXT_ALIGNS,
  VERTICAL_ALIGNS,
  type CarouselStyle,
} from "@/lib/carousel";

import { BrandColorPicker } from "./brand-color-picker";
import { MockupPicker } from "./mockup-picker";
import { RangeField, Segmented, StudioCard } from "./studio-ui";

/** Mockup, couleur et position du texte, communs à toutes les slides du carrousel. */
export function StylePanel({
  mockupAssetId,
  onMockupChange,
  mockupError,
  onFitToMockup,
  style,
  onChange,
}: {
  mockupAssetId: number | null;
  onMockupChange: (assetId: number | null) => void;
  mockupError: boolean;
  /** Recalcule la zone de texte d'après la zone libre du mockup. */
  onFitToMockup: () => void;
  style: CarouselStyle;
  onChange: (style: CarouselStyle) => void;
}) {
  const { meta } = useApp();
  const [picking, setPicking] = useState(mockupAssetId === null);
  const mockup = meta.library.find((a) => a.id === mockupAssetId);
  const set = <K extends keyof CarouselStyle>(key: K, value: CarouselStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <StudioCard
      title="Mockup & mise en page"
      description="Communs à toutes les slides."
      action={
        mockupAssetId !== null ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onFitToMockup}
            title="Placer la zone de texte dans l'espace libre du mockup et adapter la taille des caractères"
          >
            <ScanSearch /> Ajuster au mockup
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                ...DEFAULT_CAROUSEL_STYLE,
                textColor: style.textColor,
                titleColor: style.titleColor,
                accentColor: style.accentColor,
                background: style.background,
                gradientTop: style.gradientTop,
                halos: style.halos,
                footer: style.footer,
                pagination: style.pagination,
              })
            }
            title="Remettre l'alignement, les marges et les tailles par défaut"
          >
            <RotateCcw /> Par défaut
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div
            className="aspect-[4/5] w-12 shrink-0 overflow-hidden rounded border"
            style={{ backgroundColor: style.background }}
          >
            {mockup && <AssetThumb asset={mockup} className="size-full" />}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium">{mockup ? mockup.title : "Sans mockup (fond uni)"}</p>
            {mockupError && <p className="text-destructive">Image du mockup illisible.</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setPicking((v) => !v)}>
            {picking ? <ChevronUp /> : <ChevronDown />} {picking ? "Fermer" : "Changer"}
          </Button>
        </div>
        {picking && (
          <MockupPicker
            value={mockupAssetId}
            onChange={(id) => {
              onMockupChange(id);
              if (id !== null) setPicking(false);
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-2.5">
        <BrandColorPicker
          label="Couleur du titre"
          value={style.titleColor}
          onChange={(hex) => set("titleColor", hex)}
          sameLabel="Comme le texte"
          sameColor={style.textColor}
        />
        <BrandColorPicker
          label="Mots mis en avant (*entre astérisques*)"
          value={style.accentColor}
          onChange={(hex) => set("accentColor", hex)}
          sameLabel="Comme le titre"
          sameColor={style.titleColor ?? style.textColor}
        />
        <BrandColorPicker
          label="Couleur du texte"
          value={style.textColor}
          onChange={(hex) => set("textColor", hex ?? DEFAULT_TEXT_COLOR)}
        />
        {mockupAssetId === null && (
          <BrandColorPicker
            label="Fond"
            value={style.background}
            onChange={(hex) => hex && set("background", hex)}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Alignement</span>
          <Segmented label="Alignement du texte" value={style.align} options={TEXT_ALIGNS} onChange={(v) => set("align", v)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Position</span>
          <Segmented
            label="Position verticale du texte"
            value={style.vertical}
            options={VERTICAL_ALIGNS}
            onChange={(v) => set("vertical", v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <RangeField label="Taille du titre" value={style.titleSize} min={3} max={16} step={0.2} onChange={(v) => set("titleSize", v)} />
        <RangeField label="Taille du texte" value={style.bodySize} min={2} max={9} step={0.1} onChange={(v) => set("bodySize", v)} />
        <RangeField label="Marge gauche" value={style.marginLeft} min={0} max={45} step={0.5} onChange={(v) => set("marginLeft", v)} />
        <RangeField label="Marge droite" value={style.marginRight} min={0} max={45} step={0.5} onChange={(v) => set("marginRight", v)} />
        <RangeField label="Marge haut" value={style.marginTop} min={0} max={70} step={0.5} onChange={(v) => set("marginTop", v)} />
        <RangeField label="Marge bas" value={style.marginBottom} min={0} max={70} step={0.5} onChange={(v) => set("marginBottom", v)} />
        <label className="flex items-center gap-2 self-end pb-1 text-xs">
          <Checkbox checked={style.showNumbers} onCheckedChange={(v) => set("showNumbers", v === true)} />
          Numéroter les slides (2/6)
        </label>
        <label className="flex items-center gap-2 self-end pb-1 text-xs">
          <Checkbox checked={style.pagination} onCheckedChange={(v) => set("pagination", v === true)} />
          Points de pagination
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-muted-foreground">Pied de slide (en bas à gauche)</span>
        <Input
          value={style.footer}
          onChange={(e) => set("footer", e.target.value.slice(0, 80))}
          placeholder="Ex. : @tamarque · nom de la série (vide : pas de pied)"
          className="h-8"
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        La zone de texte (en pointillés sur l&apos;aperçu) se place toute seule dans l&apos;espace libre du
        mockup. Le texte trop long est réduit pour y tenir.
      </p>
    </StudioCard>
  );
}

