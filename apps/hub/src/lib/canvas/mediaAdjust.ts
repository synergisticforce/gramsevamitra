import type { MediaProgress } from './mediaImageTools';
import { splitImageBaseName } from './mediaImageTools';

/**
 * Tone, rotation, and flip adjustments for Image Studio. Pure Canvas 2D so it
 * runs offline on any device.
 */

export interface AdjustValues {
  /** 100 = unchanged, range 20–200. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Clockwise rotation in degrees: 0, 90, 180, or 270. */
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export const DEFAULT_ADJUST: AdjustValues = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
};

export function isDefaultAdjust(values: AdjustValues): boolean {
  return (
    values.brightness === 100 &&
    values.contrast === 100 &&
    values.saturation === 100 &&
    values.rotation === 0 &&
    !values.flipHorizontal &&
    !values.flipVertical
  );
}

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

function sizeOf(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  const width = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const height = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!width || !height) throw new Error('Unable to read this image.');
  return { width, height };
}

/** Auto-levels each channel so a dull photo gains full tonal range. */
function autoEnhanceInPlace(imageData: ImageData): void {
  const { data } = imageData;

  for (let channel = 0; channel < 3; channel += 1) {
    const histogram = new Uint32Array(256);
    let count = 0;
    for (let i = channel; i < data.length; i += 4) {
      histogram[data[i]] += 1;
      count += 1;
    }

    const clip = Math.floor(count * 0.005);
    let low = 0;
    let high = 255;

    let seen = 0;
    for (let v = 0; v < 256; v += 1) {
      seen += histogram[v];
      if (seen > clip) {
        low = v;
        break;
      }
    }
    seen = 0;
    for (let v = 255; v >= 0; v -= 1) {
      seen += histogram[v];
      if (seen > clip) {
        high = v;
        break;
      }
    }
    if (high - low < 16) continue;

    const lut = new Uint8ClampedArray(256);
    const range = high - low;
    for (let v = 0; v < 256; v += 1) {
      lut[v] = Math.round(255 * Math.min(1, Math.max(0, (v - low) / range)));
    }
    for (let i = channel; i < data.length; i += 4) {
      data[i] = lut[data[i]];
    }
  }
}

export interface AdjustOptions extends Partial<AdjustValues> {
  /** Apply per-channel auto-levels before the manual sliders. */
  autoEnhance?: boolean;
  /** Longest edge cap; keeps previews fast on low-end phones. */
  maxEdge?: number;
  quality?: number;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export the image.'))),
      'image/jpeg',
      quality,
    );
  });
}

export async function adjustImageInBrowser(
  file: File,
  options: AdjustOptions = {},
  onProgress?: (progress: MediaProgress) => void,
): Promise<{ blob: Blob; downloadName: string; width: number; height: number }> {
  const values: AdjustValues = { ...DEFAULT_ADJUST, ...options };
  const { autoEnhance = false, maxEdge, quality = 0.92 } = options;

  onProgress?.({ label: 'Loading image…', percent: 15 });
  const source = await decodeOriented(file);
  const { width: srcW, height: srcH } = sizeOf(source);

  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(srcW, srcH)) : 1;
  const drawW = Math.max(1, Math.round(srcW * scale));
  const drawH = Math.max(1, Math.round(srcH * scale));

  // A quarter turn swaps the output dimensions.
  const swap = values.rotation === 90 || values.rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? drawH : drawW;
  canvas.height = swap ? drawW : drawH;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  onProgress?.({ label: 'Applying adjustments…', percent: 50 });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (values.rotation) ctx.rotate((values.rotation * Math.PI) / 180);
  ctx.scale(values.flipHorizontal ? -1 : 1, values.flipVertical ? -1 : 1);
  ctx.filter = `brightness(${values.brightness}%) contrast(${values.contrast}%) saturate(${values.saturation}%)`;
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.filter = 'none';
  ctx.restore();

  if ('close' in source && typeof source.close === 'function') source.close();

  if (autoEnhance) {
    onProgress?.({ label: 'Auto-enhancing…', percent: 70 });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    autoEnhanceInPlace(imageData);
    ctx.putImageData(imageData, 0, 0);
  }

  onProgress?.({ label: 'Saving…', percent: 90 });
  const blob = await canvasToJpegBlob(canvas, quality);
  return {
    blob,
    downloadName: `${splitImageBaseName(file.name)}-adjusted.jpg`,
    width: canvas.width,
    height: canvas.height,
  };
}
