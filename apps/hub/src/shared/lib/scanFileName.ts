/**
 * Auto-generated offline scan filenames with a local timestamp.
 * Example: Scan_20260804_221530.jpg
 */
export function makeScanFileName(mimeType: string, pageIndex = 0): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  const lower = (mimeType || '').toLowerCase();
  const ext = lower.includes('pdf')
    ? 'pdf'
    : lower.includes('png')
      ? 'png'
      : lower.includes('webp')
        ? 'webp'
        : 'jpg';

  const suffix = pageIndex > 0 ? `_${pageIndex + 1}` : '';
  return `Scan_${stamp}${suffix}.${ext}`;
}
