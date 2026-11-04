import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  PLATFORM_SKILL_FILES,
  prepareSkill,
  type PlatformSkillInfo,
  type PlatformSkills,
  type SkillPurpose,
} from "@/lib/ai/platform-skills";
import { PLATFORM_IDS } from "@/lib/platforms";

// Chemin écrit en dur (voir `src/server/brand-doc.ts`).
const skillsFolder = () => path.join(process.cwd(), "brand", "skills");

function readFile(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(skillsFolder(), rel), "utf8");
  } catch {
    return null;
  }
}

/** Lit les guides de tous les réseaux, relus à chaque demande (fichiers modifiables sans redémarrer). */
export function readPlatformSkills(): PlatformSkills {
  const cache = new Map<string, string | null>();
  const read = (rel: string) => {
    if (!cache.has(rel)) cache.set(rel, readFile(rel));
    return cache.get(rel)!;
  };
  const skills: PlatformSkills = {};
  for (const platform of PLATFORM_IDS) {
    for (const purpose of Object.keys(PLATFORM_SKILL_FILES[platform]) as SkillPurpose[]) {
      const text = PLATFORM_SKILL_FILES[platform][purpose]
        .map(({ path: rel, section }) => {
          const raw = read(rel);
          return raw ? prepareSkill(raw, section) : "";
        })
        .filter(Boolean)
        .join("\n\n");
      if (text) (skills[platform] ??= {})[purpose] = text;
    }
  }
  return skills;
}

export function getPlatformSkillsInfo(): PlatformSkillInfo[] {
  const skills = readPlatformSkills();
  return PLATFORM_IDS.map((platform) => {
    const files = [
      ...new Set(Object.values(PLATFORM_SKILL_FILES[platform]).flatMap((list) => list.map((s) => s.path))),
    ];
    return {
      platform,
      files,
      missing: files.filter((f) => readFile(f) === null),
      chars: skills[platform]?.caption?.length ?? 0,
    };
  });
}
