import { Capacitor } from '@capacitor/core';

export type ScannerPlatform = 'android' | 'ios' | 'web';

export function getScannerPlatform(): ScannerPlatform {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'android';
  if (platform === 'ios') return 'ios';
  return 'web';
}

export function isNativeAndroidScannerAvailable(): boolean {
  return Capacitor.isNativePlatform() && getScannerPlatform() === 'android';
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Read a native `file://` / `content://` URI into a Blob.
 *
 * The WebView origin is `https://localhost`, so a raw `fetch()` on a native URI
 * is blocked. Convert to the Capacitor-served URL first and fall back to the
 * Filesystem plugin, which can always read an absolute native path.
 */
async function readNativeUri(uri: string): Promise<Blob> {
  const convertible = /^(file|content):/i.test(uri);
  const fetchUrl = convertible ? Capacitor.convertFileSrc(uri) : uri;

  try {
    const response = await fetch(fetchUrl);
    if (response.ok) {
      return await response.blob();
    }
  } catch (err) {
    console.warn('[documentScanner] convertFileSrc fetch failed, trying Filesystem:', err);
  }

  const { Filesystem } = await import('@capacitor/filesystem');
  const result = await Filesystem.readFile({ path: uri });
  const data = typeof result.data === 'string' ? result.data : '';
  if (!data) {
    throw new Error('Unable to read the scanned document image.');
  }
  return base64ToBlob(data, 'image/jpeg');
}

/**
 * Convert a Capacitor filesystem / content URI or data URL into a browser File.
 */
export async function uriToImageFile(uri: string, fileName = 'scanned-document.jpg'): Promise<File> {
  const blob = await readNativeUri(uri);
  const type = blob.type || 'image/jpeg';
  const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const safeName = fileName.endsWith(`.${extension}`)
    ? fileName
    : `${fileName.replace(/\.[^.]+$/, '')}.${extension}`;
  return new File([blob], safeName, { type, lastModified: Date.now() });
}

export interface NativeScanResult {
  files: File[];
  pdfUri?: string;
}

/**
 * Launch Google ML Kit Document Scanner on Android.
 * Rejects / should not be called on iOS or web — use the web camera fallback instead.
 */
export async function scanDocumentWithMlKit(options?: {
  pageLimit?: number;
  galleryImportAllowed?: boolean;
}): Promise<NativeScanResult> {
  if (!isNativeAndroidScannerAvailable()) {
    throw new Error('ML Kit document scanner is only available on Android.');
  }

  const { DocumentScanner } = await import('@capacitor-mlkit/document-scanner');

  const availability = await DocumentScanner.isGoogleDocumentScannerModuleAvailable();
  if (!availability.available) {
    await DocumentScanner.installGoogleDocumentScannerModule();
  }

  const result = await DocumentScanner.scanDocument({
    galleryImportAllowed: options?.galleryImportAllowed ?? true,
    pageLimit: options?.pageLimit ?? 10,
    resultFormats: 'JPEG',
    scannerMode: 'FULL',
  });

  const imageUris = result.scannedImages ?? [];
  if (imageUris.length === 0) {
    throw new Error('No pages were captured. Please try scanning again.');
  }

  const files = await Promise.all(
    imageUris.map((uri, index) =>
      uriToImageFile(uri, `scanned-page-${String(index + 1).padStart(2, '0')}.jpg`),
    ),
  );

  return {
    files,
    pdfUri: result.pdf?.uri,
  };
}

/**
 * Capture the current video frame from a live web camera stream into a JPEG File.
 */
export function captureFrameFromVideo(
  video: HTMLVideoElement,
  fileName = 'camera-capture.jpg',
): File {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error('Camera is not ready yet. Wait a moment and try again.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to capture from the camera.');
  }
  ctx.drawImage(video, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const binary = atob(dataUrl.split(',')[1] ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: 'image/jpeg', lastModified: Date.now() });
}
