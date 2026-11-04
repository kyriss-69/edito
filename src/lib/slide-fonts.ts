import type { BrandKit } from "@/lib/brand";
import { DEFAULT_TITLE_TRACKING, type SlideFonts } from "@/lib/carousel";

/**
 * Polices des slides du Studio, choisies d'après la charte (« Inter ExtraBold »,
 * « Outfit Bold »…). Les familles fournies avec l'app sont chargées par
 * `next/font` dans le layout racine, sous ces variables CSS ; les autres sont
 * cherchées parmi les polices installées sur l'ordinateur.
 */
export const BUNDLED_SLIDE_FONTS: Record<string, string> = {
  outfit: "--font-slide-outfit",
  "plus jakarta sans": "--font-slide-jakarta",
  inter: "--font-slide-inter",
  "inter tight": "--font-slide-inter-tight",
};

const WEIGHT_WORDS: [string, number][] = (
  [
    ["thin", 100],
    ["hairline", 100],
    ["extralight", 200],
    ["extra light", 200],
    ["ultralight", 200],
    ["light", 300],
    ["regular", 400],
    ["normal", 400],
    ["book", 400],
    ["medium", 500],
    ["semibold", 600],
    ["semi bold", 600],
    ["demibold", 600],
    ["bold", 700],
    ["extrabold", 800],
    ["extra bold", 800],
    ["ultrabold", 800],
    ["black", 900],
    ["heavy", 900],
  ] as [string, number][]
).sort((a, b) => b[0].length - a[0].length);

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace", "cursive", "system-ui", "ui-sans-serif", "ui-serif"]);

/** « Inter ExtraBold » → { family: "Inter", weight: 800 } ; « Inter 600 » → 600. */
export function parseFontName(name: string, defaultWeight: number): { family: string; weight: number } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const numeric = /^(.*\S)\s+([1-9]00)$/.exec(trimmed);
  if (numeric) return { family: numeric[1], weight: Number(numeric[2]) };
  const lower = trimmed.toLowerCase();
  for (const [word, weight] of WEIGHT_WORDS) {
    if (lower.endsWith(` ${word}`)) return { family: trimmed.slice(0, -word.length - 1), weight };
  }
  return { family: trimmed, weight: defaultWeight };
}

/** Famille CSS d'une police : variable de `next/font` si l'app la fournit, nom entre guillemets sinon. */
function cssFamily(family: string, readVar: (name: string) => string): string {
  const key = family.toLowerCase();
  if (GENERIC_FAMILIES.has(key)) return key;
  const variable = BUNDLED_SLIDE_FONTS[key];
  const loaded = variable ? readVar(variable).trim() : "";
  return loaded || `"${family.replace(/"/g, "")}"`;
}

function stack(name: string, fallback: string, readVar: (name: string) => string, defaults: { family: string; weight: number }) {
  const main = name.trim() ? parseFontName(name, defaults.weight) : defaults;
  const families = [cssFamily(main.family, readVar)];
  if (fallback.trim()) families.push(cssFamily(parseFontName(fallback, main.weight).family, readVar));
  families.push("sans-serif");
  return { family: families.join(", "), weight: main.weight };
}

/** Polices des slides d'après la charte (Outfit Bold et Plus Jakarta Sans quand elle n'en donne pas). */
export function resolveSlideFonts(
  kit: Pick<BrandKit, "fonts" | "studio">,
  readVar: (name: string) => string,
): SlideFonts {
  const heading = stack(kit.fonts.heading, kit.fonts.headingFallback, readVar, { family: "Outfit", weight: 700 });
  const body = stack(kit.fonts.body, kit.fonts.bodyFallback, readVar, { family: "Plus Jakarta Sans", weight: 400 });
  return {
    heading: heading.family,
    headingWeight: heading.weight,
    body: body.family,
    bodyWeight: body.weight,
    titleTracking: kit.studio.titleTracking ?? DEFAULT_TITLE_TRACKING,
  };
}
