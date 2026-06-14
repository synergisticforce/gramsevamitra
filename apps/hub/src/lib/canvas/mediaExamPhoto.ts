import type { MediaProgress } from './mediaImageTools';
import { splitImageBaseName } from './mediaImageTools';

const DEFAULT_THRESHOLD = 128;
const WHITE_CUTOFF = 245;

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load this image.'));
    };
    img.src = url;
  });
}

function imageToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (degrees === 0) return canvas;
  const rad = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const out = document.createElement('canvas');
  out.width = canvas.width * cos + canvas.height * sin;
  out.height = canvas.width * sin + canvas.height * cos;
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
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      if (lum < WHITE_CUTOFF) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    return source;
  }

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

function applyScanEffect(source: HTMLCanvasElement, threshold: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    const boosted = Math.min(255, gray * 1.08 + 4);
    const value = boosted > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export scanned image'))),
      'image/jpeg',
      quality
    );
  });
}

export interface ExamPhotoOptions {
  degrees?: number;
  threshold?: number;
  autoCrop?: boolean;
}

export async function processExamPhotoInBrowser(
  file: File,
  options: ExamPhotoOptions = {},
  onProgress?: (progress: MediaProgress) => void
): Promise<{ blob: Blob; downloadName: string }> {
  const degrees = options.degrees ?? 0;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const autoCrop = options.autoCrop ?? true;

  onProgress?.({ label: 'Loading image…', percent: 10 });
  const img = await loadImageFromFile(file);

  onProgress?.({ label: 'Straightening photo…', percent: 25 });
  let canvas = imageToCanvas(img);
  if (degrees !== 0) {
    canvas = rotateCanvas(canvas, degrees);
  }

  if (autoCrop) {
    onProgress?.({ label: 'Auto-cropping document edges…', percent: 45 });
    canvas = autoCropCanvas(canvas);
  }

  onProgress?.({ label: 'Applying scan & B&W effect…', percent: 70 });
  canvas = applyScanEffect(canvas, threshold);

  onProgress?.({ label: 'Preparing download…', percent: 90 });
  const blob = await canvasToJpegBlob(canvas, 0.92);
  const baseName = splitImageBaseName(file.name);
  return { blob, downloadName: `${baseName}-exam-scan.jpg` };
}

export async function previewExamPhotoInBrowser(
  file: File,
  options: ExamPhotoOptions = {}
): Promise<string> {
  const { blob } = await processExamPhotoInBrowser(file, options);
  return URL.createObjectURL(blob);
}
