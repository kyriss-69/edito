import { PLATFORMS, type PlatformId } from "./platforms";

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;

export function extractHashtags(text: string): string[] {
  return text.match(HASHTAG_RE) ?? [];
}

/** Normalise une saisie libre de hashtags : "a, #b  c" → "#a #b #c" (sans doublons). */
export function normalizeHashtags(input: string): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const word = raw.replace(/^#+/, "").trim();
    if (!word) continue;
    const tag = `#${word}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.join(" ");
}

/** Texte réellement publié sur une plateforme : légende (spécifique ou commune) + hashtags. */
export function composeCaption(caption: string, hashtags: string): string {
  const body = caption.trim();
  const tags = hashtags.trim();
  if (!tags) return body;
  if (!body) return tags;
  return `${body}\n\n${tags}`;
}

/** Hashtags publiés sur un réseau : les siens s'il en a, sinon ceux du post. */
export function platformHashtags(entry: { customHashtags: string | null }, hashtags: string): string {
  return entry.customHashtags ?? hashtags;
}

/** Garde les premiers hashtags dans la limite du réseau. */
export function trimHashtags(hashtags: string, limit: number | null): string {
  const tags = extractHashtags(hashtags);
  return limit === null ? tags.join(" ") : tags.slice(0, limit).join(" ");
}

export type CaptionCheck = {
  platform: PlatformId;
  length: number;
  limit: number;
  hashtagCount: number;
  hashtagLimit: number | null;
  tooLong: boolean;
  tooManyHashtags: boolean;
};

export function checkCaption(
  platform: PlatformId,
  caption: string,
  hashtags: string,
): CaptionCheck {
  const config = PLATFORMS[platform];
  const text = composeCaption(caption, hashtags);
  // Compte les caractères visibles (emojis = 1), comme les plateformes.
  const length = [...text].length;
  const hashtagCount = extractHashtags(text).length;
  return {
    platform,
    length,
    limit: config.captionLimit,
    hashtagCount,
    hashtagLimit: config.hashtagLimit,
    tooLong: length > config.captionLimit,
    tooManyHashtags:
      config.hashtagLimit !== null && hashtagCount > config.hashtagLimit,
  };
}
