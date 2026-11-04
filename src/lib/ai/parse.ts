/**
 * Lecture des réponses du modèle : suppression de la réflexion des modèles
 * « reasoning » et extraction du JSON demandé.
 */

const REASONING_BLOCKS = [
  /<think>[\s\S]*?<\/think>/gi,
  /\[THINK\][\s\S]*?\[\/THINK\]/gi,
];
const REASONING_OPEN = /<think>|\[THINK\]/i;

/** Retire les blocs de réflexion (<think>…</think>, [THINK]…[/THINK]). */
export function stripReasoning(text: string): string {
  let result = text;
  for (const re of REASONING_BLOCKS) result = result.replace(re, "");
  // Bloc ouvert mais jamais fermé : tout ce qui suit est de la réflexion.
  const open = result.search(REASONING_OPEN);
  if (open !== -1) result = result.slice(0, open);
  return result.trim();
}

/** Vrai si le texte se termine dans un bloc de réflexion non fermé. */
export function isInsideReasoning(text: string): boolean {
  let rest = text;
  for (const re of REASONING_BLOCKS) rest = rest.replace(re, "");
  return REASONING_OPEN.test(rest);
}

/** Trouve et parse le premier objet ou tableau JSON complet du texte. */
export function extractJson(text: string): unknown {
  const cleaned = stripReasoning(text)
    .replace(/```(?:json)?/gi, "")
    .trim();

  const direct = tryParse(cleaned);
  if (direct !== undefined) return direct;

  for (let start = 0; start < cleaned.length; start++) {
    const open = cleaned[start];
    if (open !== "{" && open !== "[") continue;
    const end = findBlockEnd(cleaned, start);
    if (end === -1) continue;
    const parsed = tryParse(cleaned.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Les modèles écrivent souvent de vrais sauts de ligne dans les chaînes JSON.
    try {
      return JSON.parse(escapeControlCharsInStrings(text));
    } catch {
      return undefined;
    }
  }
}

/** Échappe les sauts de ligne et tabulations écrits tels quels dans les chaînes JSON. */
export function escapeControlCharsInStrings(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (const char of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      else if (char === "\n") {
        result += "\\n";
        continue;
      } else if (char === "\r") continue;
      else if (char === "\t") {
        result += "\\t";
        continue;
      }
    } else if (char === '"') {
      inString = true;
    }
    result += char;
  }
  return result;
}

function findBlockEnd(text: string, start: number): number {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) return -1;
      if (stack.length === 0) return i;
    }
  }
  return -1;
}

/**
 * Découpe un flux SSE (Server-Sent Events) en charges utiles `data:`.
 * Renvoie une fonction à appeler avec chaque morceau reçu.
 */
export function createSseParser(onData: (data: string) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data:")) onData(line.slice(5).trim());
    }
  };
}
