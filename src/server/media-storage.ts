import "server-only";

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";

import { UPLOADS_DIR } from "@/lib/paths";

export const ACCEPTED_MIME = /^(image|video)\//;

export function mediaPath(fileName: string) {
  // Les noms sont générés par nous (uuid + extension) : on refuse tout le reste.
  if (!/^[a-f0-9-]+(\.[a-z0-9]+)?$/i.test(fileName)) {
    throw new Error("Nom de fichier invalide");
  }
  return path.join(UPLOADS_DIR, fileName);
}

export async function saveUpload(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const fileName = `${randomUUID()}${ext}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(
    mediaPath(fileName),
    Buffer.from(await file.arrayBuffer()),
  );
  return fileName;
}

/** Copie un fichier du disque dans le dossier des médias (nom unique). */
export function importFile(sourcePath: string): { fileName: string; size: number } {
  const fileName = `${randomUUID()}${path.extname(sourcePath).toLowerCase()}`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.copyFileSync(sourcePath, mediaPath(fileName));
  return { fileName, size: fs.statSync(sourcePath).size };
}

export function copyUpload(fileName: string): string {
  const copy = `${randomUUID()}${path.extname(fileName)}`;
  fs.copyFileSync(mediaPath(fileName), mediaPath(copy));
  return copy;
}

export function removeUpload(fileName: string) {
  fs.rmSync(mediaPath(fileName), { force: true });
}

/**
 * En-têtes de cache d'un fichier des médias. Les adresses (`/api/media/3`…)
 * reprennent les numéros de la base de l'espace ouvert : la même adresse peut
 * désigner un autre fichier dans un autre espace. Le navigateur revérifie donc
 * à chaque fois, avec le nom du fichier (unique) comme ETag.
 */
export function mediaCacheHeaders(fileName: string): Record<string, string> {
  return { "Cache-Control": "private, no-cache", ETag: `"${fileName}"` };
}

/** Le navigateur a déjà ce fichier : réponse 304 sans le contenu. */
export function notModified(request: Request, fileName: string): Response | null {
  const etag = mediaCacheHeaders(fileName).ETag;
  return request.headers.get("if-none-match") === etag
    ? new Response(null, { status: 304, headers: mediaCacheHeaders(fileName) })
    : null;
}

/** Sert un fichier du disque, avec prise en charge des requêtes `Range` (lecture vidéo). */
export async function serveFile(request: Request, filePath: string, mimeType: string) {
  let size: number;
  try {
    size = (await fs.promises.stat(filePath)).size;
  } catch {
    return new Response("Fichier manquant", { status: 404 });
  }

  const fileName = path.basename(filePath);
  const cached = notModified(request, fileName);
  if (cached) return cached;
  const headers = new Headers({
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    ...mediaCacheHeaders(fileName),
  });

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(size));
  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, { headers });
}
