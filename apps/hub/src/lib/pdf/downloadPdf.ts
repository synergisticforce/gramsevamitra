import { downloadBlob } from '@shared/utils/fileUtils';

export function downloadPdfBytes(
  bytes: Uint8Array,
  filename: string,
  toolSuffix = ''
): void {
  const copy = new Uint8Array(bytes);
  downloadBlob(new Blob([copy], { type: 'application/pdf' }), filename, toolSuffix);
}
