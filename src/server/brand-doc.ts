import "server-only";

import fs from "node:fs";
import path from "node:path";

import {
  brandDocPath,
  estimateTokens,
  isBrandDocName,
  prepareBrandDoc,
  type BrandDocInfo,
} from "@/lib/ai/brand-doc";

import { getActiveWorkspace } from "./workspace";

// Chemin écrit en dur (« brand » = dossier de `brandDocPath`) : un chemin calculé
// ferait inclure tout le projet dans le build.
const brandFolder = () => path.join(process.cwd(), "brand");

function listBrandFolder(): string[] {
  try {
    return fs.readdirSync(brandFolder());
  } catch {
    return [];
  }
}

/** Trouve le document de l'espace ouvert, ex. `brand/MARQUE.md` (voir `isBrandDocName`). */
function findBrandDoc(): string | null {
  const docName = getActiveWorkspace().brandDoc;
  const file = listBrandFolder().find((name) => isBrandDocName(name, docName));
  return file ? path.join(brandFolder(), file) : null;
}

/**
 * Lit le document de référence. Relu à chaque appel : une modification du
 * fichier est prise en compte dès la demande suivante, sans redémarrer.
 */
export function readBrandDoc(): { text: string; info: BrandDocInfo } | null {
  const file = findBrandDoc();
  if (!file) return null;
  try {
    const { text, truncated } = prepareBrandDoc(fs.readFileSync(file, "utf8"));
    if (!text) return null;
    return {
      text,
      info: {
        path: brandDocPath(getActiveWorkspace().brandDoc),
        found: true,
        chars: text.length,
        tokens: estimateTokens(text),
        truncated,
        updatedAt: fs.statSync(file).mtimeMs,
      },
    };
  } catch {
    return null;
  }
}

export function getBrandDocInfo(): BrandDocInfo {
  return (
    readBrandDoc()?.info ?? {
      path: brandDocPath(getActiveWorkspace().brandDoc),
      found: false,
      folder: brandFolder(),
      files: listBrandFolder(),
    }
  );
}
