export type PageNumberFormat = 'plain' | 'page-n' | 'n-of-total' | 'page-n-of-total';

export type PageNumberVertical = 'top' | 'bottom';

export type PageNumberHorizontal = 'left' | 'center' | 'right';

export const PAGE_NUMBER_VERTICAL_OPTIONS: { id: PageNumberVertical; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
];

export const PAGE_NUMBER_HORIZONTAL_OPTIONS: { id: PageNumberHorizontal; label: string }[] = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Center' },
  { id: 'right', label: 'Right' },
];

export const PAGE_NUMBER_FORMATS: { id: PageNumberFormat; label: string }[] = [
  { id: 'plain', label: '1' },
  { id: 'page-n', label: 'Page 1' },
  { id: 'n-of-total', label: '1 of N' },
  { id: 'page-n-of-total', label: 'Page 1 of N' },
];

export interface OverlayMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const DEFAULT_OVERLAY_MARGINS: OverlayMargins = {
  top: 36,
  bottom: 36,
  left: 36,
  right: 36,
};

export function formatPageNumber(format: PageNumberFormat, page: number, total: number): string {
  switch (format) {
    case 'plain':
      return `${page}`;
    case 'page-n':
      return `Page ${page}`;
    case 'n-of-total':
      return `${page} of ${total}`;
    case 'page-n-of-total':
      return `Page ${page} of ${total}`;
  }
}

export function pageNumberPlacementToPdfCoords(
  vertical: PageNumberVertical,
  horizontal: PageNumberHorizontal,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  options: { margins?: OverlayMargins; offsetX?: number; offsetY?: number } = {}
): { x: number; y: number } {
  const m = options.margins ?? DEFAULT_OVERLAY_MARGINS;
  const fineTuneX = Number(options.offsetX ?? 0);
  const fineTuneY = Number(options.offsetY ?? 0);

  let x: number;
  switch (horizontal) {
    case 'left':
      x = m.left + fineTuneX;
      break;
    case 'center':
      x = (pageWidth - textWidth) / 2 + fineTuneX;
      break;
    case 'right':
      x = pageWidth - textWidth - m.right + fineTuneX;
      break;
  }

  const y = vertical === 'top' ? pageHeight - m.top - fontSize + fineTuneY : m.bottom + fineTuneY;
  return { x, y };
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return { r: 0.2, g: 0.2, b: 0.2 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}
