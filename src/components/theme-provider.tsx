"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { THEME_COOKIE, type Theme } from "@/lib/preferences";

type ThemeContextValue = { theme: Theme; setTheme: (theme: Theme) => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme doit être utilisé dans <ThemeProvider>");
  return value;
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState(initial);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
