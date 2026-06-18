import { canvasToJpegBlob } from './pdfRender';

export interface ScannerEffectOptions {
  contrast: number;
  threshold: number;
}

const DEFAULT_SCANNER: ScannerEffectOptions = {
  contrast: 40,
  threshold: 128,
};

function applyScannerPixels(
  data: Uint8ClampedArray,
  contrast: number,
  threshold: number,
): void {
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  for (let i = 0; i < data.length; i += 4) {
    let gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray = factor * (gray - 128) + 128;
    gray = gray < threshold ? 0 : 255;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

export function applyScannerEffectToCanvas(
  canvas: HTMLCanvasElement,
  options: Partial<ScannerEffectOptions> = {},
): void {
  const { contrast, threshold } = { ...DEFAULT_SCANNER, ...options };
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyScannerPixels(imageData.data, contrast, threshold);
  ctx.putImageData(imageData, 0, 0);
}

export async function applyScannerEffectToImageFile(
  file: File,
  options: Partial<ScannerEffectOptions> = {},
): Promise<{ bytes: Uint8Array; kind: 'jpg' }> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas not supported');
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  applyScannerEffectToCanvas(canvas, options);
  const blob = await canvasToJpegBlob(canvas, 0.92);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg' };
}
