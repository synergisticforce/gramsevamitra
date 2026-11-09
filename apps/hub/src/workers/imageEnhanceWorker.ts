/// <reference lib="webworker" />

/**
 * On-device upscale and restore. Nothing is uploaded.
 * Super-resolution tries a small ONNX model on modest images, then falls back
 * to a Lanczos resize plus unsharp mask so every phone still gets a result.
 */

export type EnhanceMode = 'upscale-2x' | 'upscale-4x' | 'restore';
export type EnhanceEngine = 'ai' | 'resize' | 'restore';

export interface EnhanceRunRequest {
  type: 'run';
  id: string;
  mode: EnhanceMode;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  allowModel: boolean;
}

export type EnhanceOutbound = EnhanceRunRequest | { type: 'cancel'; id: string } | { type: 'dispose' };

export type EnhanceInbound =
  | { type: 'progress'; id: string; label: string; percent: number }
  | { type: 'done'; id: string; width: number; height: number; pixels: ArrayBuffer; engine: EnhanceEngine }
  | { type: 'error'; id: string; message: string }
  | { type: 'cancelled'; id: string };

const TILE = 256;
const OVERLAP = 16;
const NEURAL_MAX_EDGE: Record<2 | 4, number> = { 2: 512, 4: 384 };

let cancelledId: string | null = null;

function post(message: EnhanceInbound, transfer?: Transferable[]): void {
  if (transfer) {
    self.postMessage(message, transfer);
    return;
  }
  self.postMessage(message);
}

function assertActive(id: string): void {
  if (cancelledId === id) {
    const error = new Error('Cancelled');
    error.name = 'Cancelled';
    throw error;
  }
}

function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function lanczos(x: number, radius: number): number {
  const ax = Math.abs(x);
  if (ax < 1e-6) return 1;
  if (ax >= radius) return 0;
  const pix = Math.PI * x;
  const pixa = (Math.PI * x) / radius;
  return (Math.sin(pix) * Math.sin(pixa)) / (pix * pixa);
}

function resizeLanczos(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  id: string,
  onRow?: (row: number, total: number) => void,
): Uint8ClampedArray {
  const radius = 3;
  const tmp = new Float32Array(dw * sh * 4);
  const xScale = sw / dw;

  for (let y = 0; y < sh; y += 1) {
    if ((y & 15) === 0) assertActive(id);
    for (let x = 0; x < dw; x += 1) {
      const center = (x + 0.5) * xScale - 0.5;
      const left = Math.floor(center) - radius + 1;
      const right = Math.floor(center) + radius;
      let weightSum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let ix = left; ix <= right; ix += 1) {
        const weight = lanczos(center - ix, radius);
        if (weight === 0) continue;
        const sx = Math.min(sw - 1, Math.max(0, ix));
        const index = (y * sw + sx) * 4;
        weightSum += weight;
        r += src[index] * weight;
        g += src[index + 1] * weight;
        b += src[index + 2] * weight;
        a += src[index + 3] * weight;
      }
      const out = (y * dw + x) * 4;
      const inv = weightSum === 0 ? 0 : 1 / weightSum;
      tmp[out] = r * inv;
      tmp[out + 1] = g * inv;
      tmp[out + 2] = b * inv;
      tmp[out + 3] = a * inv;
    }
  }

  const dst = new Uint8ClampedArray(dw * dh * 4);
  const yScale = sh / dh;
  for (let y = 0; y < dh; y += 1) {
    if ((y & 15) === 0) {
      assertActive(id);
      onRow?.(y, dh);
    }
    const center = (y + 0.5) * yScale - 0.5;
    const top = Math.floor(center) - radius + 1;
    const bottom = Math.floor(center) + radius;
    for (let x = 0; x < dw; x += 1) {
      let weightSum = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let iy = top; iy <= bottom; iy += 1) {
        const weight = lanczos(center - iy, radius);
        if (weight === 0) continue;
        const sy = Math.min(sh - 1, Math.max(0, iy));
        const index = (sy * dw + x) * 4;
        weightSum += weight;
        r += tmp[index] * weight;
        g += tmp[index + 1] * weight;
        b += tmp[index + 2] * weight;
        a += tmp[index + 3] * weight;
      }
      const out = (y * dw + x) * 4;
      const inv = weightSum === 0 ? 0 : 1 / weightSum;
      dst[out] = clampByte(r * inv);
      dst[out + 1] = clampByte(g * inv);
      dst[out + 2] = clampByte(b * inv);
      dst[out + 3] = clampByte(a * inv);
    }
  }
  return dst;
}

function boxBlur(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const tmp = new Float32Array(src.length);
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let k = -1; k <= 1; k += 1) {
          const sx = Math.min(w - 1, Math.max(0, x + k));
          sum += src[(y * w + sx) * 4 + c];
        }
        tmp[(y * w + x) * 4 + c] = sum / 3;
      }
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const out = (y * w + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        for (let k = -1; k <= 1; k += 1) {
          const sy = Math.min(h - 1, Math.max(0, y + k));
          sum += tmp[(sy * w + x) * 4 + c];
        }
        dst[out + c] = clampByte(sum / 3);
      }
      dst[out + 3] = src[out + 3];
    }
  }
  return dst;
}

function unsharp(src: Uint8ClampedArray, w: number, h: number, amount: number): Uint8ClampedArray {
  const blur = boxBlur(src, w, h);
  const dst = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = clampByte(src[i] + amount * (src[i] - blur[i]));
    dst[i + 1] = clampByte(src[i + 1] + amount * (src[i + 1] - blur[i + 1]));
    dst[i + 2] = clampByte(src[i + 2] + amount * (src[i + 2] - blur[i + 2]));
    dst[i + 3] = src[i + 3];
  }
  return dst;
}

function luma(r: number, g: number, b: number): number {
  return r * 0.299 + g * 0.587 + b * 0.114;
}

function shadowFlatten(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const step = 8;
  const gw = Math.max(1, Math.ceil(w / step));
  const gh = Math.max(1, Math.ceil(h / step));
  const grid = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      const x = Math.min(w - 1, gx * step);
      const y = Math.min(h - 1, gy * step);
      const i = (y * w + x) * 4;
      grid[gy * gw + gx] = luma(src[i], src[i + 1], src[i + 2]) / 255;
    }
  }
  const blurred = new Float32Array(grid.length);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let sum = 0;
      let count = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const x = Math.min(gw - 1, Math.max(0, gx + kx));
          const y = Math.min(gh - 1, Math.max(0, gy + ky));
          sum += grid[y * gw + x];
          count += 1;
        }
      }
      blurred[gy * gw + gx] = sum / count;
    }
  }

  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y += 1) {
    const gy = Math.min(gh - 1, y / step);
    const y0 = Math.min(gh - 1, Math.floor(gy));
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = gy - y0;
    for (let x = 0; x < w; x += 1) {
      const gx = Math.min(gw - 1, x / step);
      const x0 = Math.min(gw - 1, Math.floor(gx));
      const x1 = Math.min(gw - 1, x0 + 1);
      const tx = gx - x0;
      const illum =
        blurred[y0 * gw + x0] * (1 - tx) * (1 - ty) +
        blurred[y0 * gw + x1] * tx * (1 - ty) +
        blurred[y1 * gw + x0] * (1 - tx) * ty +
        blurred[y1 * gw + x1] * tx * ty;
      const gain = 0.72 / Math.max(0.28, illum);
      const i = (y * w + x) * 4;
      dst[i] = clampByte(src[i] * gain);
      dst[i + 1] = clampByte(src[i + 1] * gain);
      dst[i + 2] = clampByte(src[i + 2] * gain);
      dst[i + 3] = src[i + 3];
    }
  }
  return dst;
}

function clahe(src: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const tile = 64;
  const tilesX = Math.max(1, Math.ceil(w / tile));
  const tilesY = Math.max(1, Math.ceil(h / tile));
  const maps: Uint8Array[] = [];

  for (let ty = 0; ty < tilesY; ty += 1) {
    for (let tx = 0; tx < tilesX; tx += 1) {
      const hist = new Uint32Array(256);
      let count = 0;
      const x0 = tx * tile;
      const y0 = ty * tile;
      const x1 = Math.min(w, x0 + tile);
      const y1 = Math.min(h, y0 + tile);
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * w + x) * 4;
          hist[clampByte(Math.round(luma(src[i], src[i + 1], src[i + 2])))] += 1;
          count += 1;
        }
      }
      const clip = Math.max(1, Math.floor((count / 256) * 2));
      let excess = 0;
      for (let b = 0; b < 256; b += 1) {
        if (hist[b] > clip) {
          excess += hist[b] - clip;
          hist[b] = clip;
        }
      }
      const share = Math.floor(excess / 256);
      for (let b = 0; b < 256; b += 1) hist[b] += share;
      const map = new Uint8Array(256);
      let cdf = 0;
      for (let b = 0; b < 256; b += 1) {
        cdf += hist[b];
        map[b] = count === 0 ? b : clampByte(Math.round((cdf / count) * 255));
      }
      maps.push(map);
    }
  }

  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const value = clampByte(Math.round(luma(src[i], src[i + 1], src[i + 2])));
      const tx = Math.min(tilesX - 1, Math.floor(x / tile));
      const ty = Math.min(tilesY - 1, Math.floor(y / tile));
      const mapped = maps[ty * tilesX + tx][value];
      const scale = value < 1 ? 1 : mapped / value;
      dst[i] = clampByte(src[i] * scale);
      dst[i + 1] = clampByte(src[i + 1] * scale);
      dst[i + 2] = clampByte(src[i + 2] * scale);
      dst[i + 3] = src[i + 3];
    }
  }
  return dst;
}

function bilateral(src: Uint8ClampedArray, w: number, h: number, id: string): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const sigma2 = 2 * 28 * 28;
  for (let y = 0; y < h; y += 1) {
    if ((y & 15) === 0) assertActive(id);
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      let wr = 0;
      let wg = 0;
      let wb = 0;
      let weightSum = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          const j = (yy * w + xx) * 4;
          const dr = src[i] - src[j];
          const dg = src[i + 1] - src[j + 1];
          const db = src[i + 2] - src[j + 2];
          const spatial = dx === 0 && dy === 0 ? 1 : 0.55;
          const weight = spatial * Math.exp(-(dr * dr + dg * dg + db * db) / sigma2);
          wr += src[j] * weight;
          wg += src[j + 1] * weight;
          wb += src[j + 2] * weight;
          weightSum += weight;
        }
      }
      dst[i] = clampByte(wr / weightSum);
      dst[i + 1] = clampByte(wg / weightSum);
      dst[i + 2] = clampByte(wb / weightSum);
      dst[i + 3] = src[i + 3];
    }
  }
  return dst;
}

function restorePixels(src: Uint8ClampedArray, w: number, h: number, id: string): Uint8ClampedArray {
  const flat = shadowFlatten(src, w, h);
  assertActive(id);
  const contrasted = clahe(flat, w, h);
  assertActive(id);
  const denoised = bilateral(contrasted, w, h, id);
  return unsharp(denoised, w, h, 0.35);
}

function tileStarts(length: number): number[] {
  if (length <= TILE) return [0];
  const stride = TILE - OVERLAP;
  const starts: number[] = [];
  for (let start = 0; start < length; start += stride) {
    starts.push(Math.min(start, length - TILE));
    if (start + TILE >= length) break;
  }
  return [...new Set(starts)];
}

function cropTile(src: Uint8ClampedArray, sw: number, x: number, y: number, tw: number, th: number): Uint8ClampedArray {
  const tile = new Uint8ClampedArray(tw * th * 4);
  for (let row = 0; row < th; row += 1) {
    const from = ((y + row) * sw + x) * 4;
    tile.set(src.subarray(from, from + tw * 4), row * tw * 4);
  }
  return tile;
}

interface ModelImage {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
}

async function loadUpscaler(scale: 2 | 4, id: string) {
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  const modelId = scale === 4 ? 'Xenova/swin2SR-classical-sr-x4-64' : 'Xenova/swin2SR-lightweight-x2-64';
  const options = {
    progress_callback: (progress: unknown) => {
      const info = progress as { status?: string; progress?: number };
      if (info.status === 'progress' && typeof info.progress === 'number') {
        post({
          type: 'progress',
          id,
          label: 'Downloading the sharpening model (one time)…',
          percent: Math.min(35, Math.round(info.progress * 0.35)),
        });
      }
    },
  };
  try {
    return await pipeline('image-to-image', modelId, { ...options, device: 'webgpu' });
  } catch {
    return await pipeline('image-to-image', modelId, { ...options, device: 'wasm' });
  }
}

type Upscaler = Awaited<ReturnType<typeof loadUpscaler>>;

async function upscaleTile(upscaler: Upscaler, tile: Uint8ClampedArray, tw: number, th: number): Promise<ModelImage> {
  const { RawImage } = await import('@huggingface/transformers');
  const input = new RawImage(tile, tw, th, 4);
  const output = await upscaler(input as never);
  const image = (output as { image?: ModelImage }).image ?? (output as ModelImage);
  if (!image?.data || !image.width || !image.height) {
    throw new Error('The sharpening model returned no image.');
  }
  return image;
}

async function neuralUpscale(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  scale: 2 | 4,
  id: string,
): Promise<Uint8ClampedArray> {
  post({ type: 'progress', id, label: 'Preparing the on-device sharpener…', percent: 8 });
  const upscaler = await loadUpscaler(scale, id);
  const xs = tileStarts(sw);
  const ys = tileStarts(sh);
  const outW = sw * scale;
  const outH = sh * scale;
  const accum = new Float32Array(outW * outH * 3);
  const weights = new Float32Array(outW * outH);
  const feather = OVERLAP * scale;
  const total = xs.length * ys.length;
  let done = 0;

  for (const y of ys) {
    for (const x of xs) {
      assertActive(id);
      const tw = Math.min(TILE, sw - x);
      const th = Math.min(TILE, sh - y);
      const tile = cropTile(src, sw, x, y, tw, th);
      const image = await upscaleTile(upscaler, tile, tw, th);
      const expectedW = tw * scale;
      const expectedH = th * scale;
      if (image.width < expectedW - 4 || image.height < expectedH - 4) {
        throw new Error('The sharpening model used an unexpected scale.');
      }
      const channels = image.channels || 3;
      for (let row = 0; row < expectedH; row += 1) {
        for (let col = 0; col < expectedW; col += 1) {
          const gx = x * scale + col;
          const gy = y * scale + row;
          if (gx >= outW || gy >= outH) continue;
          const lx = col;
          const ly = row;
          let wx = 1;
          let wy = 1;
          if (x > 0) wx = Math.min(wx, lx / feather);
          if (x + tw < sw) wx = Math.min(wx, (expectedW - 1 - lx) / feather);
          if (y > 0) wy = Math.min(wy, ly / feather);
          if (y + th < sh) wy = Math.min(wy, (expectedH - 1 - ly) / feather);
          const weight = Math.max(0, Math.min(wx, wy));
          if (weight <= 0) continue;
          const srcIndex = (row * image.width + col) * channels;
          const dstIndex = gy * outW + gx;
          accum[dstIndex * 3] += image.data[srcIndex] * weight;
          accum[dstIndex * 3 + 1] += image.data[srcIndex + 1] * weight;
          accum[dstIndex * 3 + 2] += image.data[srcIndex + 2] * weight;
          weights[dstIndex] += weight;
        }
      }
      done += 1;
      post({
        type: 'progress',
        id,
        label: `Sharpening tile ${done} of ${total}…`,
        percent: 40 + Math.round((done / total) * 50),
      });
    }
  }

  if (typeof (upscaler as { dispose?: () => Promise<void> }).dispose === 'function') {
    await (upscaler as { dispose: () => Promise<void> }).dispose();
  }

  const dst = new Uint8ClampedArray(outW * outH * 4);
  for (let i = 0; i < weights.length; i += 1) {
    const weight = weights[i] || 1;
    dst[i * 4] = clampByte(accum[i * 3] / weight);
    dst[i * 4 + 1] = clampByte(accum[i * 3 + 1] / weight);
    dst[i * 4 + 2] = clampByte(accum[i * 3 + 2] / weight);
    dst[i * 4 + 3] = 255;
  }
  return unsharp(dst, outW, outH, 0.25);
}

self.onmessage = async (event: MessageEvent<EnhanceOutbound>) => {
  const message = event.data;
  if (message.type === 'dispose') {
    cancelledId = null;
    return;
  }
  if (message.type === 'cancel') {
    cancelledId = message.id;
    return;
  }
  if (message.type !== 'run') return;

  const { id, mode, width, height } = message;
  cancelledId = cancelledId === id ? null : cancelledId;

  try {
    const src = new Uint8ClampedArray(message.pixels);
    let pixels: Uint8ClampedArray;
    let outW = width;
    let outH = height;
    let engine: EnhanceEngine = 'resize';

    if (mode === 'restore') {
      post({ type: 'progress', id, label: 'Lifting shadows and contrast…', percent: 15 });
      pixels = restorePixels(src, width, height, id);
      engine = 'restore';
    } else {
      const scale: 2 | 4 = mode === 'upscale-4x' ? 4 : 2;
      const longest = Math.max(width, height);
      const canTryModel = message.allowModel && longest <= NEURAL_MAX_EDGE[scale];
      if (canTryModel) {
        try {
          pixels = await neuralUpscale(src, width, height, scale, id);
          engine = 'ai';
        } catch (err) {
          if (err instanceof Error && err.name === 'Cancelled') throw err;
          post({
            type: 'progress',
            id,
            label: 'AI model unavailable. Using a high-quality resize…',
            percent: 40,
          });
          pixels = resizeLanczos(src, width, height, width * scale, height * scale, id, (row, total) => {
            post({
              type: 'progress',
              id,
              label: 'Resizing…',
              percent: 40 + Math.round((row / total) * 50),
            });
          });
          pixels = unsharp(pixels, width * scale, height * scale, 0.45);
        }
      } else {
        post({ type: 'progress', id, label: 'Resizing on this device…', percent: 12 });
        pixels = resizeLanczos(src, width, height, width * scale, height * scale, id, (row, total) => {
          post({
            type: 'progress',
            id,
            label: 'Resizing…',
            percent: 12 + Math.round((row / total) * 78),
          });
        });
        pixels = unsharp(pixels, width * scale, height * scale, 0.45);
      }
      outW = width * scale;
      outH = height * scale;
    }

    assertActive(id);
    const copy = pixels.slice();
    post(
      { type: 'done', id, width: outW, height: outH, pixels: copy.buffer, engine },
      [copy.buffer],
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'Cancelled') {
      post({ type: 'cancelled', id });
      return;
    }
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : 'Could not enhance this image.',
    });
  }
};
