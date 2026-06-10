/** Normalized crop rect (0–1) with top-left origin matching screen overlay. */
export interface NormalizedCropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function defaultCropRect(): NormalizedCropRect {
  return { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
}

/** Convert screen-normalized crop to pdf-lib bottom-left PostScript points. */
export function normalizedCropToPdfBox(
  crop: NormalizedCropRect,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  const width = crop.w * pageWidth;
  const height = crop.h * pageHeight;
  const x = crop.x * pageWidth;
  const y = pageHeight - (crop.y + crop.h) * pageHeight;
  return { x, y, width, height };
}
