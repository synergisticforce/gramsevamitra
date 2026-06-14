export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface ColorSwatch {
  hex: string;
  rgb: RgbColor;
}

export type HarmonyMode = 'monochromatic' | 'complementary' | 'triadic';

export type PaletteHarmony = 'complementary' | 'analogous' | 'triadic';

function normalizeHexInput(hex: string): string | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(cleaned)) return null;
  return `#${cleaned.toUpperCase()}`;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): RgbColor | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function toSwatch(rgb: RgbColor): ColorSwatch {
  return { rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
}

function randomHue(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % 360;
}

/** Quantize and count pixel colors; return top N dominant swatches. */
export function extractDominantColors(imageData: ImageData, count = 5): ColorSwatch[] {
  const { data, width, height } = imageData;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  const step = Math.max(1, Math.floor((width * height) / 12_000));

  for (let i = 0; i < width * height; i += step) {
    const px = i * 4;
    const a = data[px + 3];
    if (a < 128) continue;
    const r = data[px];
    const g = data[px + 1];
    const b = data[px + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  const sorted = [...buckets.values()]
    .map((b) => ({
      swatch: toSwatch({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) }),
      n: b.n,
    }))
    .sort((a, b) => b.n - a.n)
    .map((entry) => entry.swatch);

  const unique: ColorSwatch[] = [];
  for (const swatch of sorted) {
    if (unique.some((u) => colorDistance(u.rgb, swatch.rgb) < 35)) continue;
    unique.push(swatch);
    if (unique.length >= count) break;
  }

  while (unique.length < count) {
    unique.push(generateHarmonizedPalette('monochromatic')[unique.length % 5]);
  }

  return unique.slice(0, count);
}

function colorDistance(a: RgbColor, b: RgbColor): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export function generateHarmonizedPalette(mode: HarmonyMode, baseHue = randomHue()): ColorSwatch[] {
  const hues: number[] = [];
  if (mode === 'monochromatic') {
    hues.push(baseHue, baseHue, baseHue, baseHue, baseHue);
  } else if (mode === 'complementary') {
    hues.push(baseHue, baseHue + 30, baseHue + 180, baseHue + 210, baseHue + 180);
  } else {
    hues.push(baseHue, baseHue + 120, baseHue + 240, baseHue + 60, baseHue + 180);
  }

  const lights = [72, 58, 44, 30, 18];
  const sats = [68, 72, 76, 70, 64];

  return hues.map((h, i) => {
    const norm = ((h % 360) + 360) % 360;
    return toSwatch(hslToRgb(norm, sats[i], lights[i]));
  });
}

/** Build a 5-swatch palette from a base hex using complementary, analogous, or triadic harmony. */
export function generatePaletteFromHex(hex: string, mode: PaletteHarmony): ColorSwatch[] {
  const normalized = normalizeHexInput(hex);
  if (!normalized) return [];
  const rgb = hexToRgb(normalized.replace('#', ''));
  if (!rgb) return [];
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const sat = Math.min(100, Math.max(28, s));
  const baseL = Math.min(82, Math.max(18, l));

  let hues: number[];
  if (mode === 'complementary') {
    hues = [h, h + 180, h, h + 180, h + 180];
  } else if (mode === 'analogous') {
    hues = [h - 30, h - 15, h, h + 15, h + 30];
  } else {
    hues = [h, h + 120, h + 240, h + 60, h + 180];
  }

  const lights = [baseL, baseL + 12, baseL - 10, baseL + 20, baseL - 6];
  return hues.map((hue, i) => {
    const norm = ((hue % 360) + 360) % 360;
    const lightness = Math.max(10, Math.min(90, lights[i]));
    return toSwatch(hslToRgb(norm, sat, lightness));
  });
}

export function generateAllHarmoniesFromHex(hex: string): Record<PaletteHarmony, ColorSwatch[]> {
  return {
    complementary: generatePaletteFromHex(hex, 'complementary'),
    analogous: generatePaletteFromHex(hex, 'analogous'),
    triadic: generatePaletteFromHex(hex, 'triadic'),
  };
}

export async function loadImageToCanvas(
  file: File,
  maxSize = 400,
): Promise<{ canvas: HTMLCanvasElement; imageData: ImageData }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not load image.'));
      el.src = url;
    });

    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable.');
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    return { canvas, imageData };
  } finally {
    URL.revokeObjectURL(url);
  }
}
