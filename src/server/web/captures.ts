import "server-only";

import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { getDb } from "@/db";
import { libraryAssets } from "@/db/schema";
import { UPLOADS_DIR } from "@/lib/paths";
import { displayUrl, type CaptureDevice, type CaptureMode } from "@/lib/web";
import { mediaPath } from "@/server/media-storage";

import { capturePage } from "./browser";

export type SavedCapture = {
  assetId: number;
  title: string;
  url: string;
  width: number;
  height: number;
  device: CaptureDevice;
};

/** Capture une page et la range dans la médiathèque (catégorie « Captures »). */
export async function captureToLibrary(options: {
  url: string;
  device: CaptureDevice;
  mode: CaptureMode;
  focusText?: string;
  title?: string;
  signal?: AbortSignal;
}): Promise<SavedCapture> {
  const capture = await capturePage(options);
  const fileName = `${randomUUID()}.png`;
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  await fs.promises.writeFile(mediaPath(fileName), capture.png);

  const shown = displayUrl(capture.url);
  const title =
    options.title?.trim().slice(0, 120) ||
    `Capture ${shown}${options.focusText?.trim() ? ` · ${options.focusText.trim().slice(0, 40)}` : ""}`;
  const where = options.device === "mobile" ? "téléphone" : "ordinateur";
  const { id } = getDb()
    .insert(libraryAssets)
    .values({
      fileName,
      originalName: `capture-${shown.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "page"}.png`,
      mimeType: "image/png",
      size: capture.png.length,
      title,
      category: "screenshot",
      notes: `Capture de ${capture.url} (${where}${options.mode === "element" ? ", un bloc de la page" : ""}), le ${new Date().toLocaleDateString("fr-FR")}.`,
    })
    .returning({ id: libraryAssets.id })
    .get();
  return { assetId: id, title, url: capture.url, width: capture.width, height: capture.height, device: options.device };
}
