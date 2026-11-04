"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ChecklistItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

import { Section } from "./editor-section";

type ChecklistProps = {
  items: ChecklistItemDTO[];
  onChange: (items: ChecklistItemDTO[]) => void;
  /** Faux pour éditer seulement la liste des étapes (modèles de posts). */
  checkable?: boolean;
};

export function ChecklistSection(props: ChecklistProps) {
  const done = props.items.filter((i) => i.done).length;
  return (
    <Section
      title="Checklist"
      description={
        props.checkable !== false && props.items.length ? `${done} / ${props.items.length} terminé` : undefined
      }
    >
      <ChecklistEditor {...props} />
    </Section>
  );
}

/** Étapes cochables, modifiables sur place, avec ajout en fin de liste. */
export function ChecklistEditor({ items, onChange, checkable = true }: ChecklistProps) {
  const [label, setLabel] = useState("");
  const done = items.filter((i) => i.done).length;

  function add() {
    if (!label.trim()) return;
    onChange([...items, { label: label.trim(), done: false }]);
    setLabel("");
  }

  const patch = (index: number, value: Partial<ChecklistItemDTO>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...value } : item)));

  return (
    <div className="flex flex-col gap-3">
      {checkable && items.length > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-all"
            style={{ width: `${(done / items.length) * 100}%` }}
          />
        </div>
      )}
      <ul className="flex flex-col">
        {items.map((item, index) => (
          <li key={index} className="group flex items-center gap-2">
            {checkable ? (
              <Checkbox
                checked={item.done}
                onCheckedChange={(checked) => patch(index, { done: checked === true })}
                aria-label={item.label}
              />
            ) : (
              <span className="text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
            )}
            <Input
              value={item.label}
              onChange={(e) => patch(index, { label: e.target.value })}
              className={cn(
                "h-8 border-transparent bg-transparent shadow-none hover:border-input dark:bg-transparent",
                item.done && "text-muted-foreground line-through",
              )}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label="Supprimer l'élément"
            >
              <X />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ajouter une étape…"
          className="h-8"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!label.trim()} aria-label="Ajouter l'étape">
          <Plus /> <span className="max-sm:hidden">Ajouter</span>
        </Button>
      </div>
    </div>
  );
}
