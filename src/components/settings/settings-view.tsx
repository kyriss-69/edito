"use client";

import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLUMN_KINDS, columnKindOf } from "@/lib/columns";
import type { ColumnDTO } from "@/lib/types";
import { setColumnKind } from "@/server/actions";

import { TagList } from "./tag-list";

/** Rôle d'une colonne : ce que l'app comprend du statut de ses posts. */
function ColumnKindSelect({ column }: { column: ColumnDTO }) {
  return (
    <Select
      value={column.kind}
      onValueChange={(kind) =>
        void setColumnKind(column.id, kind).then((result) => {
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      <SelectTrigger size="sm" className="w-32 shrink-0" aria-label={`Rôle de ${column.name}`}>
        <SelectValue>{columnKindOf(column.kind).label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {COLUMN_KINDS.map((kind) => (
          <SelectItem key={kind.id} value={kind.id}>
            <div className="flex flex-col">
              <span>{kind.label}</span>
              <span className="text-xs text-muted-foreground">{kind.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Réglages › Workflow : colonnes du tableau, piliers de contenu, campagnes. */
export function WorkflowSettings() {
  const { meta } = useApp();
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <TagList
        kind="columns"
        title="Colonnes du tableau"
        description="Les étapes par lesquelles passe un post. Le rôle indique à l'app ce que signifie chaque colonne (retards, dates, colonnes repliées…)."
        items={meta.columns}
        placeholder="Nouvelle colonne…"
        renderExtra={(column) => <ColumnKindSelect column={column} />}
      />
      <div className="flex flex-col gap-4">
        <TagList
          kind="pillars"
          title="Piliers de contenu"
          description="Les grands thèmes de ta ligne éditoriale, pour garder un bon équilibre."
          items={meta.pillars}
          placeholder="Nouveau pilier…"
        />
        <TagList
          kind="campaigns"
          title="Campagnes"
          description="Regroupe les posts d'une même opération (lancement, nouvelle fonctionnalité…)."
          items={meta.campaigns}
          placeholder="Nouvelle campagne…"
        />
      </div>
    </div>
  );
}
