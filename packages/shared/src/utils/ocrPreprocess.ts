export interface PreprocessOptions {
  /** Contrast multiplier applied after grayscale (default 1.6). */
  contrast?: number;
  /** Apply Otsu binarization (default true). */
  binarize?: boolean;
  /** Max width before downscaling (keeps WASM inference fast). */
  maxWidth?: number;
}

/** Draw source image onto a canvas, optionally scaled to maxWidth. */
export function imageToCanvas(
  source: HTMLImageElement | ImageBitmap,
  maxWidth = 1280,
): HTMLCanvasElement {
  let w = source.width;
  let h = source.height;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Grayscale → contrast stretch → optional Otsu binarization.
 * Returns a new canvas (does not mutate the input).
 */
export function preprocessForOcr(
  source: HTMLCanvasElement,
  options: PreprocessOptions = {},
): HTMLCanvasElement {
  const contrast = options.contrast ?? 1.6;
  const binarize = options.binarize ?? true;

  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  const srcCtx = source.getContext('2d');
  if (!ctx || !srcCtx) throw new Error('Canvas unavailable');

  const imageData = srcCtx.getImageData(0, 0, source.width, source.height);
  const { data, width, height } = imageData;
  const histogram = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const adjusted = Math.min(255, Math.max(0, ((gray - 128) * contrast + 128)));
    data[i] = data[i + 1] = data[i + 2] = adjusted;
    histogram[Math.round(adjusted)]++;
  }

  if (binarize) {
    const threshold = otsuThreshold(histogram, width * height);
    for (let i = 0; i < data.length; i += 4) {
      const v = data[i] >= threshold ? 255 : 0;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

export interface LineSegment {
  y: number;
  height: number;
}

/** Horizontal projection to split multi-line documents for line-by-line OCR. */
export function detectTextLines(canvas: HTMLCanvasElement, minLineHeight = 8): LineSegment[] {
  const ctx = canvas.getContext('2d');
  if (!ctx) return [{ y: 0, height: canvas.height }];

  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const projection = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i] < 128) ink++;
    }
    projection[y] = ink;
  }

  const threshold = width * 0.02;
  const lines: LineSegment[] = [];
  let inLine = false;
  let start = 0;

  for (let y = 0; y < height; y++) {
    if (projection[y] > threshold) {
      if (!inLine) {
        start = y;
        inLine = true;
      }
    } else if (inLine) {
      const h = y - start;
      if (h >= minLineHeight) lines.push({ y: start, height: h });
      inLine = false;
    }
  }
  if (inLine) {
    const h = height - start;
    if (h >= minLineHeight) lines.push({ y: start, height: h });
  }

  return lines.length > 0 ? lines : [{ y: 0, height: canvas.height }];
}

/** Crop horizontal text lines from a preprocessed canvas. */
export function extractLineCanvases(canvas: HTMLCanvasElement, padding = 4): HTMLCanvasElement[] {
  const lines = detectTextLines(canvas);
  return lines.map(({ y, height }) => {
    const h = Math.min(canvas.height - y, height + padding * 2);
    const sy = Math.max(0, y - padding);
    const line = document.createElement('canvas');
    line.width = canvas.width;
    line.height = h;
    const ctx = line.getContext('2d');
    if (!ctx) return canvas;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, line.width, line.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, h, 0, 0, canvas.width, h);
    return line;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode canvas'))),
      type,
      quality,
    );
  });
}

export async function canvasToDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await canvasToBlob(canvas);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}
