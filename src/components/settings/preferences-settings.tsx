"use client";

import { toast } from "sonner";

import { useApp } from "@/components/app-provider";
import { ShortcutList } from "@/components/shell/shortcuts";
import { THEME_ICONS } from "@/components/shell/theme-menu";
import { useTheme } from "@/components/theme-provider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BOARD_DENSITIES,
  LANDING_PAGES,
  parseTheme,
  THEMES,
  type UiPreferences,
} from "@/lib/preferences";
import { saveUiPreferences } from "@/server/actions";

function Card({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Réglages › Préférences : thème, densité des cartes, page d'arrivée, raccourcis. */
export function PreferencesSettings() {
  const { meta } = useApp();
  const { theme, setTheme } = useTheme();

  function save(next: Partial<UiPreferences>) {
    void saveUiPreferences(next).then((result) => {
      if (result.ok) toast.success("Préférence enregistrée");
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Card title="Thème" description="Clair, sombre, ou celui de ton appareil.">
          <ToggleGroup
            type="single"
            value={theme}
            onValueChange={(value) => value && setTheme(parseTheme(value))}
            aria-label="Thème"
            className="self-start"
          >
            {THEMES.map((t) => {
              const Icon = THEME_ICONS[t.id];
              return (
                <ToggleGroupItem key={t.id} value={t.id}>
                  <Icon /> {t.label}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
        </Card>
        <Card title="Cartes du tableau" description="Ce que montre chaque carte du kanban.">
          <ToggleGroup
            type="single"
            value={meta.ui.boardDensity}
            onValueChange={(value) => value && save({ boardDensity: value as UiPreferences["boardDensity"] })}
            aria-label="Densité des cartes"
            className="self-start"
          >
            {BOARD_DENSITIES.map((d) => (
              <ToggleGroupItem key={d.id} value={d.id} title={d.description}>
                {d.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Card>
        <Card title="Page d'arrivée" description="La page ouverte au lancement de l'app.">
          <ToggleGroup
            type="single"
            value={meta.ui.landing}
            onValueChange={(value) => value && save({ landing: value as UiPreferences["landing"] })}
            aria-label="Page d'arrivée"
            className="self-start"
          >
            {LANDING_PAGES.map((p) => (
              <ToggleGroupItem key={p.id} value={p.id}>
                {p.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Card>
      </div>
      <Card title="Raccourcis clavier" description="Pour aller plus vite (touche ? pour les retrouver partout).">
        <ShortcutList />
      </Card>
    </div>
  );
}
