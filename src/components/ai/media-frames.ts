"use client";

import {
  ANALYSIS_IMAGE_SIDE,
  fitWithin,
  formatTimecode,
  frameTimes,
  mediaKind,
  planFrames,
} from "@/lib/ai/media";
import type { AnalysisImage } from "@/lib/ai/tasks";
import type { MediaDTO } from "@/lib/types";

const LOAD_TIMEOUT_MS = 20_000;

/** Dessine l'image réduite sur un fond blanc (transparence des PNG) et l'encode en JPEG. */
function toJpeg(source: CanvasImageSource, width: number, height: number): string {
  const size = fitWithin(width, height, ANALYSIS_IMAGE_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, 0, 0, size.width, size.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Attend un événement de l'élément, ou échoue sur `error` / délai dépassé. */
function waitFor(target: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("Délai dépassé")), LOAD_TIMEOUT_MS);
    const onEvent = () => done();
    const onError = () => done(new Error("Lecture impossible"));
    function done(error?: Error) {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    target.addEventListener(event, onEvent);
    target.addEventListener("error", onError);
  });
}

async function captureImage(url: string): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return toJpeg(img, img.naturalWidth, img.naturalHeight);
}

async function captureVideo(url: string, count: number) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = waitFor(video, "loadeddata");
    video.src = url;
    await loaded;
    const frames: { time: number; dataUrl: string }[] = [];
    for (const time of frameTimes(video.duration, count)) {
      if (Math.abs(video.currentTime - time) > 0.05) {
        const seeked = waitFor(video, "seeked");
        video.currentTime = time;
        await seeked;
      }
      frames.push({ time, dataUrl: toJpeg(video, video.videoWidth, video.videoHeight) });
    }
    return { duration: video.duration, frames };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/**
 * Prépare les images à envoyer au modèle : chaque photo réduite, et quelques
 * images extraites de chaque vidéo. Les médias illisibles par le navigateur
 * (ex. HEIC) sont ignorés et renvoyés dans `skipped`.
 */
export async function collectAnalysisImages(media: MediaDTO[], allMedia: MediaDTO[] = media) {
  const counts = planFrames(media.map((m) => mediaKind(m.mimeType)));
  const images: AnalysisImage[] = [];
  const skipped: string[] = [];
  const left: string[] = [];
  let hasVideo = false;

  for (const [index, item] of media.entries()) {
    if (counts[index] === 0) {
      left.push(item.originalName);
      continue;
    }
    const number = allMedia.indexOf(item) + 1 || index + 1;
    try {
      if (mediaKind(item.mimeType) === "video") {
        const { duration, frames } = await captureVideo(item.url, counts[index]);
        hasVideo = true;
        const length = Number.isFinite(duration) ? ` de ${formatTimecode(duration)}` : "";
        for (const frame of frames) {
          images.push({
            label: `Média ${number} — vidéo${length}, image à ${formatTimecode(frame.time)}`,
            dataUrl: frame.dataUrl,
          });
        }
      } else {
        images.push({
          label: `Média ${number} — photo${number === 1 ? " (couverture)" : ""}`,
          dataUrl: await captureImage(item.url),
        });
      }
    } catch {
      skipped.push(item.originalName);
    }
  }

  return { images, hasVideo, skipped, left };
}
