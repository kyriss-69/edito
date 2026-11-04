import "server-only";

import type { AiSettings } from "@/lib/ai/settings";
import type { BrandContext } from "@/lib/ai/tasks";
import { readPlatformSkills } from "@/server/ai/platform-skills";
import { readBrandDoc } from "@/server/brand-doc";
import { getBrandKit, getSiteNotes } from "@/server/settings";
import { readWorkspaceGuides } from "@/server/workspace-guides";

/** Ce que l'assistant sait de la marque : brief, charte, document de référence et analyse du site. */
export function getBrandContext(settings: AiSettings): BrandContext {
  const site = getSiteNotes();
  return {
    ...settings.brand,
    voices: settings.voices,
    kit: getBrandKit(),
    doc: readBrandDoc()?.text ?? null,
    guides: readWorkspaceGuides(),
    skills: readPlatformSkills(),
    site: site.summary.trim() ? { url: site.url, summary: site.summary, analyzedAt: site.analyzedAt } : null,
  };
}
