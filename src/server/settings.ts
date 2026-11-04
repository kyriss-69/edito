import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { parseAiSettings, type AiSettings } from "@/lib/ai/settings";
import { parseSiteNotes, type SiteNotes } from "@/lib/ai/site";
import { parseBrandKit, type BrandKit } from "@/lib/brand";
import { parseUiPreferences, type UiPreferences } from "@/lib/preferences";

import { getActiveWorkspace, workspaceBrandKit } from "./workspace";

function readJson(key: string): unknown {
  const row = getDb().select().from(settings).where(eq(settings.key, key)).get();
  if (!row) return undefined;
  try {
    return JSON.parse(row.value);
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  const json = JSON.stringify(value);
  getDb()
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } })
    .run();
}

export function getAiSettings(): AiSettings {
  return parseAiSettings(readJson("ai") ?? {});
}

export function writeAiSettings(value: AiSettings) {
  writeJson("ai", value);
}

/** Charte graphique (celle de l'espace par défaut). */
export function getBrandKit(): BrandKit {
  const raw = readJson("brand");
  const fallback = workspaceBrandKit(getActiveWorkspace().id);
  return raw === undefined ? fallback : parseBrandKit(raw, fallback);
}

export function writeBrandKit(value: BrandKit) {
  writeJson("brand", value);
}

/** Clé d'API d'OpenRouter : rangée à part, lue seulement côté serveur. */
export function getOpenRouterKey(): string {
  const raw = readJson("secrets");
  const key = raw && typeof raw === "object" ? (raw as { openrouterKey?: unknown }).openrouterKey : "";
  return typeof key === "string" ? key : "";
}

export function writeOpenRouterKey(key: string) {
  writeJson("secrets", { openrouterKey: key });
}

/** Préférences d'affichage (densité des cartes, colonnes repliées…). */
export function getUiPreferences(): UiPreferences {
  return parseUiPreferences(readJson("ui"));
}

export function writeUiPreferences(value: UiPreferences) {
  writeJson("ui", value);
}

/** Analyse du site de la marque (résumé envoyé à l'assistant). */
export function getSiteNotes(): SiteNotes {
  return parseSiteNotes(readJson("site"));
}

export function writeSiteNotes(value: SiteNotes) {
  writeJson("site", value);
}
