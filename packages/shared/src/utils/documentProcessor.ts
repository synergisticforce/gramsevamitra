export interface DimensionSpec {
  widthCm: number;
  heightCm: number;
  minKb: number;
  maxKb: number;
}

export interface ExamPreset {
  id: string;
  label: string;
  description: string;
  photo?: DimensionSpec;
  signature?: DimensionSpec;
  pdfMaxKb?: number;
  dpi: number;
}

const cmToPx = (cm: number, dpi: number): number => Math.round((cm / 2.54) * dpi);

export function dimensionToPixels(spec: DimensionSpec, dpi: number) {
  return {
    width: cmToPx(spec.widthCm, dpi),
    height: cmToPx(spec.heightCm, dpi),
    minBytes: spec.minKb * 1024,
    maxBytes: spec.maxKb * 1024,
  };
}

export const EXAM_PRESETS: ExamPreset[] = [
  {
    id: 'ssc-cgl',
    label: 'SSC CGL',
    description: 'Staff Selection Commission Combined Graduate Level',
    dpi: 200,
    photo: { widthCm: 3.5, heightCm: 4.5, minKb: 20, maxKb: 50 },
    signature: { widthCm: 3.5, heightCm: 1.5, minKb: 10, maxKb: 20 },
  },
  {
    id: 'upsc-cse',
    label: 'UPSC Civil Services',
    description: 'Union Public Service Commission Civil Services Examination',
    dpi: 200,
    photo: { widthCm: 3.5, heightCm: 4.5, minKb: 10, maxKb: 300 },
    signature: { widthCm: 3.5, heightCm: 1.5, minKb: 10, maxKb: 300 },
    pdfMaxKb: 300,
  },
  {
    id: 'railway-rrb',
    label: 'Railway RRB',
    description: 'Railway Recruitment Board examinations',
    dpi: 200,
    photo: { widthCm: 3.5, heightCm: 4.5, minKb: 20, maxKb: 50 },
    signature: { widthCm: 3.5, heightCm: 1.5, minKb: 10, maxKb: 20 },
  },
  {
    id: 'ibps-po',
    label: 'IBPS PO',
    description: 'Institute of Banking Personnel Selection Probationary Officer',
    dpi: 200,
    photo: { widthCm: 3.5, heightCm: 4.5, minKb: 20, maxKb: 50 },
    signature: { widthCm: 3.5, heightCm: 1.5, minKb: 10, maxKb: 20 },
  },
];

export type DocumentType = 'photo' | 'signature' | 'pdf';

export interface ProcessResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  sizeBytes: number;
  quality: number;
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
      reject(new Error('Unable to load image. Please upload a valid JPG or PNG file.'));
    };
    img.src = url;
  });
}

/** panX/panY are 0–1 (0.5 = centered) along the axis that has crop slack. */
export function cropImageToCanvas(
  source: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  panX = 0.5,
  panY = 0.5,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const sourceRatio = source.width / source.height;
  const targetRatio = targetWidth / targetHeight;

  let sx = 0;
  let sy = 0;
  let sw = source.width;
  let sh = source.height;

  if (sourceRatio > targetRatio) {
    sw = source.height * targetRatio;
    sx = (source.width - sw) * panX;
  } else {
    sh = source.width / targetRatio;
    sy = (source.height - sh) * panY;
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
  return canvas;
}

function centerCrop(
  source: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  return cropImageToCanvas(source, targetWidth, targetHeight, 0.5, 0.5);
}

async function canvasToBlob(canvas: HTMLCanvasElement, quality: number, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode image'));
      },
      mimeType,
      quality
    );
  });
}

async function compressToTargetSize(
  canvas: HTMLCanvasElement,
  minBytes: number,
  maxBytes: number,
  mimeType: string
): Promise<{ blob: Blob; quality: number }> {
  let low = 0.4;
  let high = 0.98;
  let bestBlob: Blob | null = null;
  let bestQuality = high;

  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    const blob = await canvasToBlob(canvas, mid, mimeType);

    if (blob.size <= maxBytes) {
      bestBlob = blob;
      bestQuality = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  if (!bestBlob) {
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const canvasBlob = await canvasToBlob(canvas, 0.92, mimeType);
      const file = new File([canvasBlob], 'optimize.jpg', { type: mimeType });
      const compressed = await imageCompression(file, {
        maxSizeMB: maxBytes / (1024 * 1024),
        maxWidthOrHeight: Math.max(canvas.width, canvas.height),
        useWebWorker: true,
        initialQuality: 0.85,
      });
      if (compressed.size <= maxBytes) {
        return { blob: compressed, quality: 0.85 };
      }
    } catch {
      /* fall through to error below */
    }
    const fallback = await canvasToBlob(canvas, 0.4, mimeType);
    if (fallback.size > maxBytes) {
      throw new Error(
        `Unable to compress below ${Math.round(maxBytes / 1024)}KB while preserving legibility. Try a simpler background.`
      );
    }
    return { blob: fallback, quality: 0.4 };
  }

  if (bestBlob.size > maxBytes) {
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const file = new File([bestBlob], 'optimize.jpg', { type: mimeType });
      const compressed = await imageCompression(file, {
        maxSizeMB: maxBytes / (1024 * 1024),
        maxWidthOrHeight: Math.max(canvas.width, canvas.height),
        useWebWorker: true,
      });
      if (compressed.size <= maxBytes) {
        return { blob: compressed, quality: bestQuality };
      }
    } catch {
      /* use canvas result */
    }
  }

  if (bestBlob.size < minBytes && bestQuality < 0.98) {
    const higher = await canvasToBlob(canvas, Math.min(bestQuality + 0.05, 0.98), mimeType);
    if (higher.size <= maxBytes) {
      return { blob: higher, quality: Math.min(bestQuality + 0.05, 0.98) };
    }
  }

  return { blob: bestBlob, quality: bestQuality };
}

export async function processImageCanvas(
  canvas: HTMLCanvasElement,
  spec: DimensionSpec,
  dpi: number,
  type: 'photo' | 'signature',
  baseName: string,
  mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<ProcessResult> {
  const { width, height, minBytes, maxBytes } = dimensionToPixels(spec, dpi);
  if (canvas.width !== width || canvas.height !== height) {
    throw new Error(`Canvas must be ${width}×${height}px for this preset.`);
  }

  const { blob, quality } = await compressToTargetSize(canvas, minBytes, maxBytes, mimeType);
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const safeBase = baseName.replace(/\.[^.]+$/, '') || 'exam-image';

  return {
    blob,
    fileName: `${safeBase}-${type}-${spec.widthCm}x${spec.heightCm}cm.${ext}`,
    width,
    height,
    sizeBytes: blob.size,
    quality,
  };
}

export async function processImageDocument(
  file: File,
  spec: DimensionSpec,
  dpi: number,
  type: 'photo' | 'signature',
  panX = 0.5,
  panY = 0.5,
): Promise<ProcessResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a JPG or PNG image.');
  }

  const { width, height } = dimensionToPixels(spec, dpi);
  const image = await loadImageFromFile(file);
  const canvas = cropImageToCanvas(image, width, height, panX, panY);
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return processImageCanvas(canvas, spec, dpi, type, baseName, mimeType);
}

/** ResizePixel-style custom pixel dimensions with explicit KB target. */
export async function processImageToPixelTarget(
  file: File,
  widthPx: number,
  heightPx: number,
  targetMaxKb: number,
  type: 'photo' | 'signature' = 'photo',
  panX = 0.5,
  panY = 0.5,
): Promise<ProcessResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload a JPG or PNG image.');
  }
  if (widthPx < 32 || heightPx < 32) {
    throw new Error('Width and height must be at least 32 pixels.');
  }
  if (targetMaxKb < 1) {
    throw new Error('Target file size must be at least 1 KB.');
  }

  const image = await loadImageFromFile(file);
  const canvas = cropImageToCanvas(image, widthPx, heightPx, panX, panY);
  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const minBytes = Math.max(1024, Math.floor(targetMaxKb * 1024 * 0.5));
  const maxBytes = targetMaxKb * 1024;
  const { blob, quality } = await compressToTargetSize(canvas, minBytes, maxBytes, mimeType);
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'optimized-image';
  const ext = mimeType === 'image/png' ? 'png' : 'jpg';

  return {
    blob,
    fileName: `${baseName}-${type}-${widthPx}x${heightPx}px.${ext}`,
    width: widthPx,
    height: heightPx,
    sizeBytes: blob.size,
    quality,
  };
}

export async function processPdfDocument(file: File, maxKb: number): Promise<ProcessResult> {
  if (file.type !== 'application/pdf') {
    throw new Error('Please upload a PDF file.');
  }

  const maxBytes = maxKb * 1024;
  if (file.size <= maxBytes) {
    return {
      blob: file,
      fileName: file.name,
      width: 0,
      height: 0,
      sizeBytes: file.size,
      quality: 1,
    };
  }

  throw new Error(
    `PDF is ${Math.round(file.size / 1024)}KB. UPSC limit is ${maxKb}KB. Please compress externally and re-upload.`
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
