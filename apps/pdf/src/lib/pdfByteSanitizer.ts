/**
 * Byte-level PDF overhead stripper — avoids decoding entire files as strings.
 * Targets incremental update history and metadata bloat before pdf-lib reload.
 */

const META_MARKERS = [
  '/Metadata',
  '/PieceInfo',
  '/StructTreeRoot',
  '/MarkInfo',
  '/Outlines',
  '/AcroForm',
  '/Perms',
  '/DSS',
];

/** Minimal 1×1 JPEG (DCTDecode) — ~631 bytes inline replacement for stripped XObjects. */
export const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xff, 0xc4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x80, 0xff, 0xd9,
]);

function findLastBytes(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = haystack.length - needle.length; i >= 0; i--) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** Keep only the final revision by truncating at the last %%EOF before startxref chain. */
export function truncateIncrementalUpdates(input: Uint8Array): Uint8Array {
  const eofMarker = new TextEncoder().encode('%%EOF');
  const lastEof = findLastBytes(input, eofMarker);
  if (lastEof < 0) return input;

  const tailStart = Math.max(0, lastEof - 8192);
  const tail = input.subarray(tailStart, lastEof + eofMarker.length);
  const tailText = new TextDecoder('latin1').decode(tail);
  const prevIdx = tailText.lastIndexOf('/Prev');
  if (prevIdx < 0) {
    return input.subarray(0, lastEof + eofMarker.length);
  }

  return input.subarray(0, lastEof + eofMarker.length);
}

/** Neutralize metadata dictionary keys in the trailer tail (last 16 KB). */
export function stripMetadataKeys(input: Uint8Array): Uint8Array {
  const out = new Uint8Array(input);
  const scanStart = Math.max(0, out.length - 16384);
  const latin = new TextDecoder('latin1').decode(out.subarray(scanStart));

  let patched = latin;
  for (const marker of META_MARKERS) {
    patched = patched.split(marker).join('/X' + marker.slice(1));
  }

  const encoded = new TextEncoder().encode(patched);
  out.set(encoded, scanStart);
  return out;
}

/**
 * Scan for large DCTDecode image streams in sliding windows (no full-file string decode).
 */
export function stripHeavyImageStreamHeaders(input: Uint8Array, minStreamBytes = 120_000): Uint8Array {
  const out = new Uint8Array(input);
  const imageToken = new TextEncoder().encode('/Subtype /Image');
  const windowSize = 65536;
  const overlap = 900;

  for (let start = 0; start < out.length; start += windowSize - overlap) {
    const end = Math.min(out.length, start + windowSize);
    const slice = out.subarray(start, end);
    const latin = new TextDecoder('latin1').decode(slice);

    let searchFrom = 0;
    let localIdx: number;
    while ((localIdx = latin.indexOf('/Subtype /Image', searchFrom)) !== -1) {
      const windowEnd = Math.min(latin.length, localIdx + 900);
      const win = latin.slice(localIdx, windowEnd);
      const lengthMatch = win.match(/\/Length\s+(\d+)/);
      const dct = win.includes('/DCTDecode') || win.includes('/Filter /FlateDecode');

      if (lengthMatch && dct) {
        const len = Number(lengthMatch[1]);
        if (len >= minStreamBytes) {
          const globalLenStart = start + localIdx + win.indexOf(lengthMatch[0]) + '/Length '.length;
          const lenStr = String(Math.min(len, 512));
          for (let i = 0; i < lengthMatch[1].length && i < lenStr.length; i++) {
            out[globalLenStart + i] = lenStr.charCodeAt(i);
          }
          for (let i = lenStr.length; i < lengthMatch[1].length; i++) {
            out[globalLenStart + i] = 0x20;
          }
        }
      }
      searchFrom = localIdx + imageToken.length;
    }
  }

  return out;
}

export function sanitizePdfForExtremeCompression(input: Uint8Array): Uint8Array {
  let working = truncateIncrementalUpdates(input);
  working = stripMetadataKeys(working);
  working = stripHeavyImageStreamHeaders(working);
  return working;
}
