/** Normalized redaction box — top-left origin, 0–1 range. */
export interface RedactionBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageRedactions {
  pageIndex: number;
  boxes: RedactionBox[];
}

export function normalizedBoxToPdfRect(
  box: RedactionBox,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const width = box.w * pageWidth;
  const height = box.h * pageHeight;
  const x = box.x * pageWidth;
  const y = pageHeight - (box.y + box.h) * pageHeight;
  return { x, y, width, height };
}
