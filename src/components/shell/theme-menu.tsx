"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { parseTheme, THEMES } from "@/lib/preferences";

export const THEME_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/** Choix du thème (clair, sombre ou celui de l'appareil). */
export function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const Icon = THEME_ICONS[theme];
  return (
    <DropdownMenu>
      <Hint label="Thème">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Thème">
            <Icon />
          </Button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(parseTheme(value))}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
