"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { normalizeHashtags } from "@/lib/captions";
import { cn } from "@/lib/utils";

/**
 * Hashtags en pastilles : Espace, Entrée ou virgule valident un hashtag,
 * Retour arrière dans le champ vide retire le dernier. Le texte collé est découpé.
 */
export function HashtagInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [text, setText] = useState("");
  const tags = normalizeHashtags(value).split(" ").filter(Boolean);

  function commit(input: string) {
    if (!input.trim()) return;
    onChange(normalizeHashtags(`${value} ${input}`));
    setText("");
  }

  return (
    <div
      className={cn(
        "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        className,
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(tags.filter((t) => t !== tag).join(" "))}
            className="rounded-full p-0.5 hover:bg-primary/15"
            aria-label={`Retirer ${tag}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          // Un séparateur tapé ou un collage de plusieurs hashtags : on valide tout de suite.
          if (/[\s,;]/.test(next)) commit(next);
          else setText(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          } else if (e.key === "Backspace" && !text && tags.length) {
            onChange(tags.slice(0, -1).join(" "));
          }
        }}
        onBlur={() => commit(text)}
        placeholder={tags.length ? "Ajouter…" : "#tamarque #contenu"}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
