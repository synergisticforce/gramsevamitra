/**
 * Auto-generated offline scan filenames with a local timestamp.
 * Example: Scan_20260804_221530_418.jpg  (page 2 → Scan_20260804_221530_418_p2.jpg)
 *
 * Milliseconds plus a per-session counter keep names unique when several pages
 * are saved inside the same second, which otherwise made two vault entries
 * share a name and resolve to the wrong file.
 */
let sequence = 0;

export function extensionForMimeType(mimeType: string): string {
  const lower = (mimeType || '').toLowerCase();
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('heic') || lower.includes('heif')) return 'heic';
  return 'jpg';
}

export function makeScanFileName(mimeType: string, pageIndex = 0): string {
  const now = new Date();
  const pad = (value: number, length = 2) => String(value).padStart(length, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
    '_',
    pad(now.getMilliseconds(), 3),
  ].join('');

  sequence = (sequence + 1) % 1000;
  const unique = pad(sequence, 3);
  const suffix = pageIndex > 0 ? `_p${pageIndex + 1}` : '';

  return `Scan_${stamp}${unique}${suffix}.${extensionForMimeType(mimeType)}`;
}
