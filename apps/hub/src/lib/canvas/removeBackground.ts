import { splitImageBaseName } from './mediaImageTools';
import type {
  BgRemovalInbound,
  BgRemovalOutbound,
} from '../../workers/backgroundRemoval.worker';

/**
 * Free, on-device background removal. Nothing is uploaded, so ID and passport
 * photos never leave the phone.
 */

export const BG_MODEL_MB = 44;

/** Inference cost grows quickly with resolution; cap the longest edge. */
const MAX_EDGE = 1600;

export interface RemoveBackgroundProgress {
  label: string;
  percent: number;
}

export type BackgroundFill = 'transparent' | 'white' | 'blue' | 'red';

const FILL_COLOURS: Record<Exclude<BackgroundFill, 'transparent'>, string> = {
  white: '#ffffff',
  blue: '#0d6efd',
  red: '#dc2626',
};

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

function drawScaled(source: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!srcW || !srcH) throw new Error('Unable to read this image.');

  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function runWorker(
  pixels: ArrayBuffer,
  width: number,
  height: number,
  onProgress: (progress: RemoveBackgroundProgress) => void,
): Promise<{ mask: Uint8Array; width: number; height: number }> {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL('../../workers/backgroundRemoval.worker.ts', import.meta.url), {
    type: 'module',
  });

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.postMessage({ type: 'dispose' } satisfies BgRemovalOutbound);
      worker.terminate();
    };

    const handler = (event: MessageEvent<BgRemovalInbound>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress({ label: data.label, percent: data.percent });
        return;
      }
      if (data.type === 'done' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        resolve({ mask: new Uint8Array(data.mask), width: data.width, height: data.height });
        return;
      }
      if (data.type === 'error' && data.id === id) {
        worker.removeEventListener('message', handler);
        cleanup();
        reject(new Error(data.message));
      }
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', (event) => {
      cleanup();
      reject(new Error(event.message || 'Background removal failed to start.'));
    });

    worker.postMessage(
      { type: 'remove', id, width, height, pixels } satisfies BgRemovalOutbound,
      [pixels],
    );
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not save the cut-out image.'))),
      'image/png',
    );
  });
}

export interface RemoveBackgroundResult {
  blob: Blob;
  downloadName: string;
  width: number;
  height: number;
}

export async function removeBackgroundInBrowser(
  file: File,
  fill: BackgroundFill,
  onProgress: (progress: RemoveBackgroundProgress) => void,
): Promise<RemoveBackgroundResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    onProgress({ label: 'Checking for the saved model…', percent: 2 });
  }

  onProgress({ label: 'Reading the photo…', percent: 3 });
  const source = await decodeOriented(file);
  const canvas = drawScaled(source);
  if ('close' in source && typeof source.close === 'function') source.close();

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // The buffer is transferred to the worker, so copy it first.
  const pixels = imageData.data.slice().buffer;

  const { mask } = await runWorker(pixels, canvas.width, canvas.height, onProgress);

  onProgress({ label: 'Applying the cut-out…', percent: 96 });
  const output = ctx.createImageData(canvas.width, canvas.height);
  output.data.set(imageData.data);
  for (let i = 0; i < mask.length; i += 1) {
    output.data[i * 4 + 3] = mask[i];
  }

  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('This device cannot process images.');

  if (fill !== 'transparent') {
    outCtx.fillStyle = FILL_COLOURS[fill];
    outCtx.fillRect(0, 0, out.width, out.height);
  }

  // Draw the masked pixels through an intermediate canvas so the solid fill
  // stays behind the subject rather than replacing its alpha.
  const masked = document.createElement('canvas');
  masked.width = canvas.width;
  masked.height = canvas.height;
  const maskedCtx = masked.getContext('2d');
  if (!maskedCtx) throw new Error('This device cannot process images.');
  maskedCtx.putImageData(output, 0, 0);
  outCtx.drawImage(masked, 0, 0);

  onProgress({ label: 'Complete', percent: 100 });
  return {
    blob: await canvasToPngBlob(out),
    downloadName: `${splitImageBaseName(file.name)}-no-background.png`,
    width: out.width,
    height: out.height,
  };
}
