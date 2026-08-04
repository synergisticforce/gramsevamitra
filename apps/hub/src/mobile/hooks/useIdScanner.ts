import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { localVaultService } from '../../shared/services/LocalVaultService';
import { initMLKitScanner } from '../../shared/services/mlkitPreloader';

export interface IdScannerHookResult {
  scanIdCard: () => Promise<void>;
  isScanningId: boolean;
  idError: string | null;
}

const A4_WIDTH = 800;
const A4_HEIGHT = 1131;
const PAD = 32;

function isUserCancellation(message: string): boolean {
  return /cancel|dismiss|user.?cancel|activity.?result/i.test(message);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function blobFromUri(uri: string): Promise<Blob> {
  try {
    const src = Capacitor.convertFileSrc(uri);
    const response = await fetch(src);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return blob.type ? blob : new Blob([blob], { type: 'image/jpeg' });
      }
    }
  } catch (err) {
    console.warn('[useIdScanner] fetch(uri) failed, trying Filesystem:', err);
  }

  const { Filesystem } = await import('@capacitor/filesystem');
  const result = await Filesystem.readFile({ path: uri });
  const data = typeof result.data === 'string' ? result.data : '';
  if (!data) {
    throw new Error('Unable to read a scanned ID image from device storage.');
  }
  return base64ToBlob(data, 'image/jpeg');
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode a scanned ID image.'));
    };
    image.src = url;
  });
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
): void {
  const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const offsetX = x + (boxWidth - drawWidth) / 2;
  const offsetY = y + (boxHeight - drawHeight) / 2;
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

async function mergeIdSidesToJpeg(front: HTMLImageElement, back: HTMLImageElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = A4_WIDTH;
  canvas.height = A4_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas for ID merge.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  const halfHeight = (A4_HEIGHT - PAD * 3) / 2;
  const boxWidth = A4_WIDTH - PAD * 2;

  drawContainedImage(ctx, front, PAD, PAD, boxWidth, halfHeight);
  drawContainedImage(ctx, back, PAD, PAD * 2 + halfHeight, boxWidth, halfHeight);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', 0.9);
  });

  if (!blob) {
    throw new Error('Failed to export the merged ID card image.');
  }
  return blob;
}

export function useIdScanner(): IdScannerHookResult {
  const [isScanningId, setIsScanningId] = useState(false);
  const [idError, setIdError] = useState<string | null>(null);

  const scanIdCard = useCallback(async () => {
    setIdError(null);

    if (!Capacitor.isNativePlatform()) {
      setIdError('Scanning is only available on the mobile app.');
      return;
    }

    setIsScanningId(true);

    try {
      await initMLKitScanner();

      const { DocumentScanner } = await import('@capacitor-mlkit/document-scanner');
      const result = await DocumentScanner.scanDocument({
        galleryImportAllowed: true,
        pageLimit: 2,
        resultFormats: 'JPEG',
        scannerMode: 'FULL',
      });

      const images = result.scannedImages ?? [];
      if (images.length < 2) {
        throw new Error('Please scan both the front and back of the ID card.');
      }

      const [frontBlob, backBlob] = await Promise.all([
        blobFromUri(images[0]),
        blobFromUri(images[1]),
      ]);
      const [frontImage, backImage] = await Promise.all([
        loadImageFromBlob(frontBlob),
        loadImageFromBlob(backBlob),
      ]);

      const merged = await mergeIdSidesToJpeg(frontImage, backImage);
      await localVaultService.saveFile(merged, 'ID_Card_Merged.jpg', 'image/jpeg');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isUserCancellation(message)) {
        setIdError(null);
        return;
      }
      console.warn('[useIdScanner] ID scan failed:', message);
      setIdError(message || 'ID card scan failed.');
    } finally {
      setIsScanningId(false);
    }
  }, []);

  return { scanIdCard, isScanningId, idError };
}
