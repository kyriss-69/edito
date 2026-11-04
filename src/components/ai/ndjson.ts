/** Lit une réponse NDJSON (un objet JSON par ligne) au fil de l'eau. */
export async function readNdjson<E>(res: Response, onEvent: (event: E) => void): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as E);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as E);
}

/** Message d'erreur d'une réponse refusée (`{ error }`). */
export async function responseError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}
