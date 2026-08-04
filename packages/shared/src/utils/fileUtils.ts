import { deliverFile, type DeliveryResult } from './fileDelivery';

export { describeDelivery, isNativeRuntime, type DeliveryResult } from './fileDelivery';

export interface FilenameParts {
  baseName: string;
  extension: string;
}

/**
 * Splits a filename on the last dot so names like `my.form.v2.pdf` keep their base intact.
 */
export function splitFilename(filename: string): FilenameParts {
  const trimmed = (filename || 'download').trim() || 'download';
  const lastDot = trimmed.lastIndexOf('.');

  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { baseName: trimmed, extension: '' };
  }

  return {
    baseName: trimmed.slice(0, lastDot),
    extension: trimmed.slice(lastDot + 1),
  };
}

/**
 * Builds `[BaseName][ToolSuffix]_gramsevamitra.[Extension]`.
 *
 * @example getBrandedFilename('Aadhar.pdf') → `Aadhar_gramsevamitra.pdf`
 * @example getBrandedFilename('Signature.jpeg', '_compressed') → `Signature_compressed_gramsevamitra.jpeg`
 */
export function getBrandedFilename(originalFilename: string, toolSuffix: string = ''): string {
  const { baseName, extension } = splitFilename(originalFilename);
  const brandedBase = `${baseName}${toolSuffix}_gramsevamitra`;
  return extension ? `${brandedBase}.${extension}` : brandedBase;
}

export function buildPageExportFilename(
  sourceFilename: string,
  pageNumber: number,
  format: 'jpg' | 'jpeg' | 'png'
): string {
  const { baseName } = splitFilename(sourceFilename);
  return `${baseName}-page-${pageNumber}.${format}`;
}

/**
 * Hand a finished file to the user. Downloads in a browser; on Android the blob
 * is written to Documents and offered via the share sheet, because a WebView
 * ignores `<a download>` on a blob URL.
 */
export function downloadBlob(blob: Blob, filename: string, toolSuffix = ''): void {
  void deliverFile(blob, getBrandedFilename(filename, toolSuffix)).catch((err) => {
    console.error('[fileUtils] Could not deliver file:', err);
  });
}

/** Awaitable variant for callers that want to confirm where the file landed. */
export function saveBlob(
  blob: Blob,
  filename: string,
  toolSuffix = '',
): Promise<DeliveryResult> {
  return deliverFile(blob, getBrandedFilename(filename, toolSuffix));
}
