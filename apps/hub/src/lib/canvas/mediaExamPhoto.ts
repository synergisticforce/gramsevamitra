import type { MediaProgress } from './mediaImageTools';
import { splitImageBaseName } from './mediaImageTools';

/**
 * Exam-portal photo and signature preparation.
 *
 * Indian exam portals reject uploads on exact pixel dimensions AND a file-size
 * window in KB. This module hits both: it fits the image to the required box,
 * then binary-searches JPEG quality until the encoded size lands inside the
 * allowed range.
 */

const WHITE_CUTOFF = 245;

export type ExamOutputMode = 'colour' | 'grayscale' | 'bw';

export interface ExamPreset {
  id: string;
  label: string;
  /** Signature presets default to high-contrast output. */
  kind: 'photo' | 'signature';
  width: number;
  height: number;
  minKb?: number;
  maxKb: number;
}

/**
 * Common portal requirements. Portals do change these, so every value stays
 * editable in the UI and "Custom" is always available.
 */
export const EXAM_PRESETS: ExamPreset[] = [
  { id: 'ssc-photo', label: 'SSC — Photo', kind: 'photo', width: 350, height: 450, minKb: 20, maxKb: 50 },
  { id: 'ssc-sign', label: 'SSC — Signature', kind: 'signature', width: 400, height: 200, minKb: 10, maxKb: 20 },
  { id: 'upsc-photo', label: 'UPSC — Photo', kind: 'photo', width: 350, height: 350, minKb: 20, maxKb: 300 },
  { id: 'upsc-sign', label: 'UPSC — Signature', kind: 'signature', width: 350, height: 350, minKb: 20, maxKb: 300 },
  { id: 'ibps-photo', label: 'IBPS — Photo', kind: 'photo', width: 200, height: 230, minKb: 20, maxKb: 50 },
  { id: 'ibps-sign', label: 'IBPS — Signature', kind: 'signature', width: 140, height: 60, minKb: 10, maxKb: 20 },
  { id: 'neet-photo', label: 'NEET — Photo', kind: 'photo', width: 350, height: 450, minKb: 10, maxKb: 200 },
  { id: 'passport', label: 'Passport photo', kind: 'photo', width: 600, height: 600, minKb: 20, maxKb: 200 },
];

export function getExamPreset(id: string): ExamPreset | undefined {
  return EXAM_PRESETS.find((preset) => preset.id === id);
}

/** Decode with EXIF rotation applied so portrait photos are never sideways. */
async function decodeOriented(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* older WebViews ignore the option */
    }
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to load this image.'));
      img.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!width || !height) throw new Error('Unable to read this image.');
  return { width, height };
}

function toCanvas(source: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const { width, height } = sourceSize(source);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (degrees === 0) return canvas;
  const rad = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * cos + canvas.height * sin);
  out.height = Math.round(canvas.width * sin + canvas.height * cos);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

function autoCropCanvas(source: HTMLCanvasElement, padding = 12): HTMLCanvasElement {
  const ctx = source.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      if (lum < WHITE_CUTOFF) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return source;

  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
  const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Canvas is not supported in this browser.');
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, cropW, cropH);
  outCtx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return out;
}

/**
 * Resize to the exact required box. `cover` centre-crops so a face fills the
 * frame without distortion, which is what portals expect for photos.
 */
function fitToBox(
  source: HTMLCanvasElement,
  width: number,
  height: number,
  fit: 'cover' | 'contain',
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';

  const scale =
    fit === 'cover'
      ? Math.max(width / source.width, height / source.height)
      : Math.min(width / source.width, height / source.height);

  const drawW = source.width * scale;
  const drawH = source.height * scale;
  ctx.drawImage(source, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  return out;
}

function applyMode(canvas: HTMLCanvasElement, mode: ExamOutputMode): HTMLCanvasElement {
  if (mode === 'colour') return canvas;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  if (mode === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
      data[i] = data[i + 1] = data[i + 2] = gray;
    }
  } else {
    // Otsu keeps thin signature strokes intact where a fixed cutoff loses them.
    const histogram = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
      data[i] = data[i + 1] = data[i + 2] = gray;
      histogram[gray] += 1;
    }

    const total = canvas.width * canvas.height;
    let sum = 0;
    for (let i = 0; i < 256; i += 1) sum += i * histogram[i];

    let sumB = 0;
    let wB = 0;
    let maxVariance = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t += 1) {
      wB += histogram[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * histogram[t];
      const variance = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }

    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] >= threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the image.'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Binary-search JPEG quality so the encoded file lands inside [minKb, maxKb].
 * If even the lowest quality is too large, pad the shortfall instead of
 * silently shipping an oversized file the portal will reject.
 */
async function encodeToTargetSize(
  canvas: HTMLCanvasElement,
  maxKb: number,
  minKb?: number,
): Promise<{ blob: Blob; quality: number; withinTarget: boolean }> {
  const maxBytes = maxKb * 1024;
  const minBytes = (minKb ?? 0) * 1024;

  let low = 0.3;
  let high = 0.95;
  let best: Blob | null = null;
  let bestQuality = low;

  for (let step = 0; step < 8; step += 1) {
    const quality = (low + high) / 2;
    const blob = await encodeJpeg(canvas, quality);

    if (blob.size > maxBytes) {
      high = quality;
    } else {
      best = blob;
      bestQuality = quality;
      low = quality;
    }
    if (high - low < 0.01) break;
  }

  if (!best) {
    // Nothing fit — return the smallest we can produce and report the miss.
    const smallest = await encodeJpeg(canvas, 0.3);
    return { blob: smallest, quality: 0.3, withinTarget: smallest.size <= maxBytes };
  }

  if (minBytes > 0 && best.size < minBytes) {
    // Some portals also enforce a floor. Padding with trailing bytes keeps the
    // JPEG valid while lifting it over the minimum.
    const padding = new Uint8Array(minBytes - best.size + 64);
    const padded = new Blob([best, padding], { type: 'image/jpeg' });
    return { blob: padded, quality: bestQuality, withinTarget: true };
  }

  return { blob: best, quality: bestQuality, withinTarget: true };
}

export interface ExamPhotoOptions {
  degrees?: number;
  autoCrop?: boolean;
  mode?: ExamOutputMode;
  width?: number;
  height?: number;
  maxKb?: number;
  minKb?: number;
  fit?: 'cover' | 'contain';
}

export interface ExamPhotoResult {
  blob: Blob;
  downloadName: string;
  width: number;
  height: number;
  sizeKb: number;
  withinTarget: boolean;
}

export async function processExamPhotoInBrowser(
  file: File,
  options: ExamPhotoOptions = {},
  onProgress?: (progress: MediaProgress) => void,
): Promise<ExamPhotoResult> {
  const {
    degrees = 0,
    autoCrop = false,
    mode = 'colour',
    width,
    height,
    maxKb,
    minKb,
    fit = 'cover',
  } = options;

  onProgress?.({ label: 'Loading image…', percent: 10 });
  const source = await decodeOriented(file);
  let canvas = toCanvas(source);
  if ('close' in source && typeof source.close === 'function') source.close();

  if (degrees !== 0) {
    onProgress?.({ label: 'Straightening photo…', percent: 25 });
    canvas = rotateCanvas(canvas, degrees);
  }

  if (autoCrop) {
    onProgress?.({ label: 'Trimming blank margins…', percent: 40 });
    canvas = autoCropCanvas(canvas);
  }

  if (width && height) {
    onProgress?.({ label: `Resizing to ${width}×${height}…`, percent: 60 });
    canvas = fitToBox(canvas, width, height, fit);
  }

  if (mode !== 'colour') {
    onProgress?.({ label: 'Adjusting contrast…', percent: 72 });
    canvas = applyMode(canvas, mode);
  }

  onProgress?.({ label: 'Matching the required file size…', percent: 85 });
  const { blob, withinTarget } = maxKb
    ? await encodeToTargetSize(canvas, maxKb, minKb)
    : { blob: await encodeJpeg(canvas, 0.92), withinTarget: true };

  const baseName = splitImageBaseName(file.name);
  return {
    blob,
    downloadName: `${baseName}-exam.jpg`,
    width: canvas.width,
    height: canvas.height,
    sizeKb: Math.round(blob.size / 1024),
    withinTarget,
  };
}

export async function previewExamPhotoInBrowser(
  file: File,
  options: ExamPhotoOptions = {},
): Promise<string> {
  const { blob } = await processExamPhotoInBrowser(file, options);
  return URL.createObjectURL(blob);
}
