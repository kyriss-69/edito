/**
 * Détection de la zone libre d'un mockup : le plus grand rectangle de la
 * couleur de fond, à l'écart des décorations (logo, formes, flèches…).
 * Travaille sur une version réduite de l'image (quelques dizaines de pixels de côté).
 */

export type ZoneMargins = {
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
};

type Pixels = { width: number; height: number; data: ArrayLike<number> };

/** Écart de couleur au-delà duquel une case n'est plus du fond. */
const TOLERANCE = 26;
/** Marge intérieure ajoutée autour de la zone détectée, en %. */
const PADDING = 2;

/** Couleur de fond : la plus fréquente de l'image. */
function backgroundColor({ width, height, data }: Pixels): [number, number, number] {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  let best = { count: 0, r: 0, g: 0, b: 0 };
  for (const bucket of buckets.values()) if (bucket.count > best.count) best = bucket;
  return [best.r / best.count, best.g / best.count, best.b / best.count];
}

/** Plus grand rectangle de cases libres (algorithme de l'histogramme). */
function largestRectangle(free: boolean[][], width: number, height: number) {
  const heights = new Array<number>(width).fill(0);
  let best = { x: 0, y: 0, w: 0, h: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) heights[x] = free[y][x] ? heights[x] + 1 : 0;
    const stack: number[] = [];
    for (let x = 0; x <= width; x++) {
      const h = x < width ? heights[x] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop()!;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[top] * (x - left);
        if (area > best.w * best.h) best = { x: left, y: y - heights[top] + 1, w: x - left, h: heights[top] };
      }
      stack.push(x);
    }
  }
  return best;
}

/** Plus grand rectangle libre centré horizontalement sur l'image (texte aligné sur un logo centré). */
function largestCenteredRectangle(free: boolean[][], width: number, height: number) {
  const left = Math.floor((width - 1) / 2);
  const right = Math.ceil((width - 1) / 2);
  // Demi-largeur libre de chaque ligne autour du centre.
  const half = free.map((row) => {
    let h = 0;
    while (left - h >= 0 && right + h < width && row[left - h] && row[right + h]) h++;
    return h;
  });
  let best = { x: 0, y: 0, w: 0, h: 0 };
  for (let y0 = 0; y0 < height; y0++) {
    let min = Infinity;
    for (let y1 = y0; y1 < height && half[y1] > 0; y1++) {
      min = Math.min(min, half[y1]);
      const w = right - left + 1 + 2 * (min - 1);
      const h = y1 - y0 + 1;
      if (w * h > best.w * best.h) best = { x: left - min + 1, y: y0, w, h };
    }
  }
  return best;
}

/**
 * Marges (en %) de la zone libre du mockup, ou `null` si aucune zone assez
 * grande n'est trouvée. Une zone centrée est préférée si elle est presque
 * aussi grande que la plus grande zone libre.
 */
export function detectFreeZone(pixels: Pixels): ZoneMargins | null {
  const { width, height, data } = pixels;
  if (width < 4 || height < 4) return null;
  const [br, bg, bb] = backgroundColor(pixels);

  const isBackground = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return Math.hypot(data[i] - br, data[i + 1] - bg, data[i + 2] - bb) < TOLERANCE && data[i + 3] > 200;
  };
  // Une case est libre si elle et ses voisines sont du fond (garde une distance avec les décorations).
  const free = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (!isBackground(nx, ny)) return false;
        }
      }
      return true;
    }),
  );

  const largest = largestRectangle(free, width, height);
  const centered = largestCenteredRectangle(free, width, height);
  const rect = centered.w * centered.h >= 0.75 * largest.w * largest.h ? centered : largest;
  if (rect.w < width * 0.3 || rect.h < height * 0.2) return null;

  const pct = (cells: number, total: number) => Math.round((cells / total) * 1000) / 10;
  return {
    marginLeft: pct(rect.x, width) + PADDING,
    marginRight: pct(width - rect.x - rect.w, width) + PADDING,
    marginTop: pct(rect.y, height) + PADDING,
    marginBottom: pct(height - rect.y - rect.h, height) + PADDING,
  };
}
