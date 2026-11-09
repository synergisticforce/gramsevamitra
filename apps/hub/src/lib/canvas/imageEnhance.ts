import { splitImageBaseName } from './mediaImageTools';
import type { EnhanceEngine, EnhanceInbound, EnhanceMode, EnhanceOutbound } from '../../workers/imageEnhanceWorker';

export type { EnhanceMode, EnhanceEngine };

export interface ImageEnhanceProgress {
  label: string;
  percent: number;
}

export interface ImageEnhanceResult {
  blob: Blob;
  downloadName: string;
  width: number;
  height: number;
  engine: EnhanceEngine;
}

const MAX_SOURCE_EDGE: Record<EnhanceMode, number> = {
  restore: 1400,
  'upscale-2x': 1400,
  'upscale-4x': 800,
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

function drawScaled(source: ImageBitmap | HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!srcW || !srcH) throw new Error('Unable to read this image.');

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(srcW * scale));
  canvas.height = Math.max(1, Math.round(srcH * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This device cannot process images.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not save the image.'))),
      'image/png',
    );
  });
}

export function enhanceImageInBrowser(
  file: File,
  mode: EnhanceMode,
  onProgress: (progress: ImageEnhanceProgress) => void,
  signal?: AbortSignal,
): Promise<ImageEnhanceResult> {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL('../../workers/imageEnhanceWorker.ts', import.meta.url), {
    type: 'module',
  });

  const stop = () => {
    worker.postMessage({ type: 'dispose' } satisfies EnhanceOutbound);
    worker.terminate();
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    };
    const succeed = (result: ImageEnhanceResult) => {
      if (settled) return;
      settled = true;
      stop();
      resolve(result);
    };

    const onAbort = () => {
      worker.postMessage({ type: 'cancel', id } satisfies EnhanceOutbound);
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    worker.addEventListener('message', (event: MessageEvent<EnhanceInbound>) => {
      const data = event.data;
      if (data.type === 'progress' && data.id === id) {
        onProgress({ label: data.label, percent: data.percent });
        return;
      }
      if (data.type === 'cancelled' && data.id === id) {
        fail(new DOMException('Cancelled', 'AbortError'));
        return;
      }
      if (data.type === 'error' && data.id === id) {
        fail(new Error(data.message));
        return;
      }
      if (data.type !== 'done' || data.id !== id) return;

      const canvas = document.createElement('canvas');
      canvas.width = data.width;
      canvas.height = data.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fail(new Error('This device cannot process images.'));
        return;
      }
      const image = new ImageData(new Uint8ClampedArray(data.pixels), data.width, data.height);
      ctx.putImageData(image, 0, 0);
      const suffix = mode === 'restore' ? 'restored' : mode === 'upscale-4x' ? 'upscale-4x' : 'upscale-2x';
      void canvasToPngBlob(canvas)
        .then((blob) => {
          onProgress({ label: 'Complete', percent: 100 });
          succeed({
            blob,
            downloadName: `${splitImageBaseName(file.name)}-${suffix}.png`,
            width: data.width,
            height: data.height,
            engine: data.engine,
          });
        })
        .catch((err: unknown) => {
          fail(err instanceof Error ? err : new Error('Could not save the image.'));
        });
    });

    worker.addEventListener('error', (event) => {
      fail(new Error(event.message || 'Image enhancement failed to start.'));
    });

    void (async () => {
      try {
        onProgress({ label: 'Reading the photo…', percent: 3 });
        const source = await decodeOriented(file);
        const canvas = drawScaled(source, MAX_SOURCE_EDGE[mode]);
        if ('close' in source && typeof source.close === 'function') source.close();
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('This device cannot process images.');
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = image.data.slice().buffer;
        if (signal?.aborted) {
          fail(new DOMException('Cancelled', 'AbortError'));
          return;
        }
        worker.postMessage(
          {
            type: 'run',
            id,
            mode,
            width: canvas.width,
            height: canvas.height,
            pixels,
            allowModel: typeof navigator === 'undefined' ? false : navigator.onLine !== false,
          } satisfies EnhanceOutbound,
          [pixels],
        );
      } catch (err) {
        fail(err instanceof Error ? err : new Error('Could not read this image.'));
      }
    })();
  });
}
