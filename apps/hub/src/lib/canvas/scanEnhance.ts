/**
 * Scan enhancement presets applied to a captured page before it is saved.
 *
 * A raw phone photo of paper is dim, colour-cast, and unevenly lit. These
 * filters run entirely on-device with Canvas 2D and are what make a capture
 * look like a scan rather than a snapshot.
 */

export type ScanFilter = 'original' | 'auto' | 'grayscale' | 'bw';

export interface ScanFilterOption {
  id: ScanFilter;
  label: string;
  hint: string;
}

export const SCAN_FILTERS: ScanFilterOption[] = [
  { id: 'auto', label: 'Auto', hint: 'Brightens paper and sharpens text' },
  { id: 'original', label: 'Original', hint: 'Keep the photo exactly as taken' },
  { id: 'grayscale', label: 'Grayscale', hint: 'Neutral grey, smaller file' },
  { id: 'bw', label: 'Black & White', hint: 'Highest contrast for printed text' },
];

/** Longest edge kept after enhancement — keeps saved scans sharp but compact. */
const MAX_EDGE = 2200;

/**
 * Decode honouring EXIF orientation. Phone cameras store portrait shots as
 * landscape plus a rotation flag, so skipping this saves sideways pages.
 */
async function decodeOriented(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* older WebViews ignore the option — fall through */
    }
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the <img> path */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not read this image.'));
      image.src = url;
    });
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

function drawToCanvas(source: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('Could not read this image.');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Percentile black/white points per channel, ignoring rare extreme pixels. */
function channelLevels(
  data: Uint8ClampedArray,
  offset: number,
  clipFraction: number,
): { low: number; high: number } {
  const histogram = new Uint32Array(256);
  let count = 0;
  for (let i = offset; i < data.length; i += 4) {
    histogram[data[i]] += 1;
    count += 1;
  }

  const clip = Math.floor(count * clipFraction);
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

  if (high - low < 16) {
    return { low: 0, high: 255 };
  }
  return { low, high };
}

function buildLevelsLut(low: number, high: number, gamma: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const range = Math.max(1, high - low);
  for (let v = 0; v < 256; v += 1) {
    const normalized = Math.min(1, Math.max(0, (v - low) / range));
    lut[v] = Math.round(255 * normalized ** gamma);
  }
  return lut;
}

function otsuThreshold(histogram: Uint32Array, total: number): number {
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
    const meanB = sumB / wB;
    const meanF = (sum - sumB) / wF;
    const variance = wB * wF * (meanB - meanF) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Auto-levels each channel independently, which removes the yellow/blue cast
 * of indoor light and lifts grey paper to white while keeping ink dark.
 */
function applyMagicColor(imageData: ImageData): void {
  const { data } = imageData;
  const gamma = 0.85;
  const lut = [0, 1, 2].map((channel) => {
    const { low, high } = channelLevels(data, channel, 0.005);
    return buildLevelsLut(low, high, gamma);
  });

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[0][data[i]];
    data[i + 1] = lut[1][data[i + 1]];
    data[i + 2] = lut[2][data[i + 2]];
  }
}

function applyGrayscale(imageData: ImageData, stretch: boolean): void {
  const { data } = imageData;
  const histogram = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = gray;
    histogram[gray] += 1;
  }

  if (!stretch) return;

  const { low, high } = channelLevels(data, 0, 0.005);
  const lut = buildLevelsLut(low, high, 0.9);
  for (let i = 0; i < data.length; i += 4) {
    const v = lut[data[i]];
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function applyBlackAndWhite(imageData: ImageData): void {
  const { data, width, height } = imageData;
  applyGrayscale(imageData, true);

  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]] += 1;
  }

  // Otsu picks the threshold from the image itself, so it adapts to lighting
  // instead of using one hardcoded cutoff for every photo.
  const threshold = otsuThreshold(histogram, width * height);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] >= threshold ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not save the enhanced page.'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Apply a scan filter to a captured page.
 *
 * `original` still passes through decode + resize so EXIF rotation is baked in
 * and an oversized camera frame is brought down to a sane size.
 */
export async function enhanceScan(file: File, filter: ScanFilter): Promise<File> {
  const source = await decodeOriented(file);
  const canvas = drawToCanvas(source);
  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot process images.');

  if (filter !== 'original') {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (filter === 'auto') applyMagicColor(imageData);
    else if (filter === 'grayscale') applyGrayscale(imageData, true);
    else if (filter === 'bw') applyBlackAndWhite(imageData);
    ctx.putImageData(imageData, 0, 0);
  }

  const quality = filter === 'bw' ? 0.88 : 0.92;
  const blob = await canvasToBlob(canvas, quality);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'scan';

  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
