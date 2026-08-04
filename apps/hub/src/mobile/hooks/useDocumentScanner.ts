import { useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { localVaultService } from '../../shared/services/LocalVaultService';
import { initMLKitScanner } from '../../shared/services/mlkitPreloader';

export interface ScannerHookResult {
  scanDocument: () => Promise<void>;
  isScanning: boolean;
  error: string | null;
}

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
        return blob.type ? blob : new Blob([blob], { type: 'application/pdf' });
      }
    }
  } catch (err) {
    console.warn('[useDocumentScanner] fetch(uri) failed, trying Filesystem:', err);
  }

  const { Filesystem } = await import('@capacitor/filesystem');
  const result = await Filesystem.readFile({ path: uri });
  const data = typeof result.data === 'string' ? result.data : '';
  if (!data) {
    throw new Error('Unable to read the scanned PDF from device storage.');
  }
  return base64ToBlob(data, 'application/pdf');
}

export function useDocumentScanner(): ScannerHookResult {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanDocument = useCallback(async () => {
    setError(null);

    if (!Capacitor.isNativePlatform()) {
      setError('Scanning is only available on the mobile app.');
      return;
    }

    setIsScanning(true);

    try {
      await initMLKitScanner();

      const { DocumentScanner } = await import('@capacitor-mlkit/document-scanner');
      const result = await DocumentScanner.scanDocument({
        galleryImportAllowed: true,
        pageLimit: 20,
        resultFormats: 'PDF',
        scannerMode: 'FULL',
      });

      const pdfUri = result.pdf?.uri;
      if (!pdfUri) {
        throw new Error('Scan completed but no PDF was returned. Please try again.');
      }

      const blob = await blobFromUri(pdfUri);
      await localVaultService.saveFile(blob, 'Scanned_Doc.pdf', 'application/pdf');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isUserCancellation(message)) {
        setError(null);
        return;
      }
      console.warn('[useDocumentScanner] scan failed:', message);
      setError(message || 'Document scan failed.');
    } finally {
      setIsScanning(false);
    }
  }, []);

  return { scanDocument, isScanning, error };
}
