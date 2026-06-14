import { downloadBlob } from '@shared/utils/fileUtils';
import { formatFileSize } from './documentCanvasStorage';

export type MediaProgress = { label: string; percent: number };

export type ResizeCompressMode = 'dimensions' | 'file-size';

export interface DimensionsResizeOptions {
  mode: 'dimensions';
  width: number;
  height: number;
  lockAspect: boolean;
  /** Optional extra cap after resize (KB). */
  targetKb?: number;
}

export interface FileSizeResizeOptions {
  mode: 'file-size';
  targetKb: number;
}

export type ResizeCompressOptions = DimensionsResizeOptions | FileSizeResizeOptions;

export type OutputImageFormat = 'jpeg' | 'png' | 'webp';

const OUTPUT_MIME: Record<OutputImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const OUTPUT_EXT: Record<OutputImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

export function splitImageBaseName(name: string): string {
  return name.replace(/\.[^.]+$/i, '') || 'image';
}

export async function readImageDimensions(
  file: File
): Promise<{ width: number; height: number; aspect: number }> {
  const img = await loadImageFromFile(file);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    aspect: img.naturalWidth / img.naturalHeight,
  };
}

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
      reject(new Error('Unable to load this image. Please upload a valid JPG, PNG, or WebP file.'));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode image'))),
      mimeType,
      quality
    );
  });
}

function resolveOutputMime(file: File): string {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function resizeImageToCanvas(
  img: HTMLImageElement,
  width: number,
  height: number,
  lockAspect: boolean
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (lockAspect) {
    const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const dx = (width - drawW) / 2;
    const dy = (height - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  } else {
    ctx.drawImage(img, 0, 0, width, height);
  }

  return canvas;
}

async function compressWithLibrary(
  file: File,
  options: {
    maxSizeMB?: number;
    maxWidthOrHeight: number;
    fileType?: string;
    initialQuality?: number;
  },
  onProgress?: (progress: MediaProgress) => void
): Promise<Blob> {
  onProgress?.({ label: 'Compressing with browser-image-compression…', percent: 70 });
  const imageCompression = (await import('browser-image-compression')).default;
  const result = await imageCompression(file, {
    maxSizeMB: options.maxSizeMB,
    maxWidthOrHeight: options.maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: options.initialQuality ?? 0.85,
    fileType: options.fileType,
  });
  onProgress?.({ label: 'Compression complete', percent: 95 });
  return result;
}

export async function resizeCompressImageInBrowser(
  file: File,
  options: ResizeCompressOptions,
  onProgress?: (progress: MediaProgress) => void
): Promise<{ blob: Blob; downloadName: string; savingsLabel: string }> {
  onProgress?.({ label: 'Loading image…', percent: 10 });

  const mimeType = resolveOutputMime(file);
  const baseName = splitImageBaseName(file.name);
  const originalBytes = file.size;

  let blob: Blob;

  if (options.mode === 'file-size') {
    if (options.targetKb < 1) {
      throw new Error('Target file size must be at least 1 KB.');
    }
    blob = await compressWithLibrary(
      file,
      {
        maxSizeMB: options.targetKb / 1024,
        maxWidthOrHeight: 4096,
        fileType: mimeType,
      },
      onProgress
    );
  } else {
    const width = Math.round(options.width);
    const height = Math.round(options.height);
    if (width < 32 || height < 32) {
      throw new Error('Width and height must be at least 32 pixels.');
    }
    if (width > 8192 || height > 8192) {
      throw new Error('Maximum dimension is 8192 pixels.');
    }

    onProgress?.({ label: 'Resizing image…', percent: 35 });
    const img = await loadImageFromFile(file);
    const canvas = resizeImageToCanvas(img, width, height, options.lockAspect);
    const canvasBlob = await canvasToBlob(canvas, mimeType, 0.92);
    const resizedFile = new File([canvasBlob], `${baseName}-resized`, { type: mimeType });

    if (options.targetKb && options.targetKb > 0) {
      blob = await compressWithLibrary(
        resizedFile,
        {
          maxSizeMB: options.targetKb / 1024,
          maxWidthOrHeight: Math.max(width, height),
          fileType: mimeType,
        },
        onProgress
      );
    } else {
      onProgress?.({ label: 'Optimizing output…', percent: 75 });
      blob = await compressWithLibrary(
        resizedFile,
        {
          maxWidthOrHeight: Math.max(width, height),
          fileType: mimeType,
          initialQuality: 0.88,
        },
        onProgress
      );
    }
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const downloadName = `${baseName}-optimized.${ext}`;
  const saved = Math.max(0, originalBytes - blob.size);
  const savedPct = originalBytes > 0 ? Math.round((saved / originalBytes) * 100) : 0;
  const savingsLabel = `${formatFileSize(originalBytes)} → ${formatFileSize(blob.size)} · saved ${formatFileSize(saved)} (${savedPct}%)`;

  return { blob, downloadName, savingsLabel };
}

export async function convertImageFormatInBrowser(
  file: File,
  format: OutputImageFormat,
  onProgress?: (progress: MediaProgress) => void
): Promise<{ blob: Blob; downloadName: string }> {
  onProgress?.({ label: 'Loading image…', percent: 15 });

  const img = await loadImageFromFile(file);
  onProgress?.({ label: 'Redrawing on canvas…', percent: 45 });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  const mimeType = OUTPUT_MIME[format];
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  onProgress?.({ label: `Exporting as ${OUTPUT_EXT[format].toUpperCase()}…`, percent: 75 });

  const quality = format === 'png' ? undefined : 0.92;
  const blob = await canvasToBlob(canvas, mimeType, quality);

  const baseName = splitImageBaseName(file.name);
  const downloadName = `${baseName}.${OUTPUT_EXT[format]}`;

  onProgress?.({ label: 'Complete', percent: 100 });
  return { blob, downloadName };
}

export function triggerImageDownload(
  blob: Blob,
  filename: string,
  toolSuffix: '_optimized' | '_converted'
): void {
  downloadBlob(blob, filename, toolSuffix);
}
