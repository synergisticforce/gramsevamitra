export type OverlayPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const OVERLAY_POSITIONS: OverlayPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export const OVERLAY_POSITION_LABELS: Record<OverlayPosition, string> = {
  'top-left': 'Top Left',
  'top-center': 'Top Center',
  'top-right': 'Top Right',
  'center-left': 'Center Left',
  center: 'Center',
  'center-right': 'Center Right',
  'bottom-left': 'Bottom Left',
  'bottom-center': 'Bottom Center',
  'bottom-right': 'Bottom Right',
};

export type WatermarkFontFamily = 'Helvetica' | 'Times Roman' | 'Courier';

export const WATERMARK_FONT_FAMILIES: { id: WatermarkFontFamily; label: string }[] = [
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'Times Roman', label: 'Times Roman' },
  { id: 'Courier', label: 'Courier' },
];

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

export type PageNumberStyle = 'standard' | 'bold' | 'large';

export const PAGE_NUMBER_STYLES: { id: PageNumberStyle; label: string; size: number; bold: boolean }[] = [
  { id: 'standard', label: 'Standard', size: 11, bold: false },
  { id: 'bold', label: 'Bold', size: 14, bold: true },
  { id: 'large', label: 'Large', size: 18, bold: true },
];

export type WatermarkLayer = 'over' | 'under';

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

/** CSS % placement for live thumbnail preview (top-left origin). */
export function overlayPositionToCss(
  position: OverlayPosition,
  offsetX = 0,
  offsetY = 0
): {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform: string;
} {
  const pad = '8%';
  const ox = `${offsetX}px`;
  const oy = `${offsetY}px`;

  switch (position) {
    case 'top-left':
      return { top: `calc(${pad} + ${oy})`, left: `calc(${pad} + ${ox})`, transform: 'none' };
    case 'top-center':
      return { top: `calc(${pad} + ${oy})`, left: '50%', transform: `translateX(calc(-50% + ${ox}))` };
    case 'top-right':
      return { top: `calc(${pad} + ${oy})`, right: `calc(${pad} - ${ox})`, transform: 'none' };
    case 'center-left':
      return { top: '50%', left: `calc(${pad} + ${ox})`, transform: `translateY(calc(-50% + ${oy}))` };
    case 'center':
      return {
        top: '50%',
        left: '50%',
        transform: `translate(calc(-50% + ${ox}), calc(-50% + ${oy}))`,
      };
    case 'center-right':
      return { top: '50%', right: `calc(${pad} - ${ox})`, transform: `translateY(calc(-50% + ${oy}))` };
    case 'bottom-left':
      return { bottom: `calc(${pad} - ${oy})`, left: `calc(${pad} + ${ox})`, transform: 'none' };
    case 'bottom-center':
      return { bottom: `calc(${pad} - ${oy})`, left: '50%', transform: `translateX(calc(-50% + ${ox}))` };
    case 'bottom-right':
      return { bottom: `calc(${pad} - ${oy})`, right: `calc(${pad} - ${ox})`, transform: 'none' };
  }
}

/** CSS placement for page-number top/bottom + left/center/right controls. */
export function pageNumberPlacementToCss(
  vertical: PageNumberVertical,
  horizontal: PageNumberHorizontal,
  offsetX = 0,
  offsetY = 0
): {
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  transform: string;
} {
  const pad = '8%';
  const ox = `${offsetX * 0.35}px`;
  const oy = `${offsetY * 0.35}px`;

  const horizontalStyle = (() => {
    switch (horizontal) {
      case 'left':
        return { left: `calc(${pad} + ${ox})`, right: undefined, transform: 'none' as const };
      case 'center':
        return { left: '50%', right: undefined, transform: `translateX(calc(-50% + ${ox}))` };
      case 'right':
        return { left: undefined, right: `calc(${pad} - ${ox})`, transform: 'none' as const };
    }
  })();

  if (vertical === 'top') {
    return { top: `calc(${pad} + ${oy})`, bottom: undefined, ...horizontalStyle };
  }
  return { top: undefined, bottom: `calc(${pad} - ${oy})`, ...horizontalStyle };
}

/** pdf-lib coordinates for page-number placement (origin bottom-left). */
export function pageNumberPlacementToPdfCoords(
  vertical: PageNumberVertical,
  horizontal: PageNumberHorizontal,
  pageWidth: number,
  pageHeight: number,
  textWidth: number,
  fontSize: number,
  options: OverlayCoordOptions = {}
): { x: number; y: number } {
  const m = options.margins ?? DEFAULT_OVERLAY_MARGINS;
  const fineTuneX = Number(options.offsetX ?? 0);
  const fineTuneY = Number(options.offsetY ?? 0);
  const pw = Number(pageWidth);
  const ph = Number(pageHeight);
  const tw = Number(textWidth);
  const fs = Number(fontSize);
  const mt = Number(m.top);
  const mb = Number(m.bottom);
  const ml = Number(m.left);
  const mr = Number(m.right);

  let x: number;
  switch (horizontal) {
    case 'left':
      x = ml + fineTuneX;
      break;
    case 'center':
      x = (pw - tw) / 2 + fineTuneX;
      break;
    case 'right':
      x = pw - tw - mr + fineTuneX;
      break;
  }

  const y =
    vertical === 'top' ? ph - mt - fs + fineTuneY : mb + fineTuneY;

  return { x, y };
}

export interface OverlayCoordOptions {
  margins?: OverlayMargins;
  offsetX?: number;
  offsetY?: number;
}

/** pdf-lib coordinates (origin bottom-left). */
export function overlayPositionToPdfCoords(
  position: OverlayPosition,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
  options: OverlayCoordOptions = {}
): { x: number; y: number } {
  const m = options.margins ?? {
    top: Math.max(18, pageWidth * 0.04),
    bottom: Math.max(18, pageWidth * 0.04),
    left: Math.max(18, pageWidth * 0.04),
    right: Math.max(18, pageWidth * 0.04),
  };
  const ox = options.offsetX ?? 0;
  const oy = options.offsetY ?? 0;
  const yBaseline = contentHeight * 0.85;

  switch (position) {
    case 'top-left':
      return { x: m.left + ox, y: pageHeight - m.top - yBaseline + oy };
    case 'top-center':
      return { x: pageWidth / 2 - contentWidth / 2 + ox, y: pageHeight - m.top - yBaseline + oy };
    case 'top-right':
      return { x: pageWidth - m.right - contentWidth + ox, y: pageHeight - m.top - yBaseline + oy };
    case 'center-left':
      return { x: m.left + ox, y: pageHeight / 2 - contentHeight / 2 + oy };
    case 'center':
      return { x: pageWidth / 2 - contentWidth / 2 + ox, y: pageHeight / 2 - contentHeight / 2 + oy };
    case 'center-right':
      return { x: pageWidth - m.right - contentWidth + ox, y: pageHeight / 2 - contentHeight / 2 + oy };
    case 'bottom-left':
      return { x: m.left + ox, y: m.bottom + oy };
    case 'bottom-center':
      return { x: pageWidth / 2 - contentWidth / 2 + ox, y: m.bottom + oy };
    case 'bottom-right':
      return { x: pageWidth - m.right - contentWidth + ox, y: m.bottom + oy };
  }
}

export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return { r: 0.1, g: 0.1, b: 0.1 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

/** CSS `rotate()` is clockwise; pdf-lib uses counter-clockwise radians. */
export function cssRotationToPdfDegrees(cssDegrees: number): number {
  return -cssDegrees;
}

/**
 * pdf-lib rotates drawImage/drawText around the bottom-left anchor (x, y).
 * CSS preview rotates around the bounding-box center — compute the anchor
 * that keeps the center fixed at (cx, cy) after rotation.
 */
export function bottomLeftForCenterRotation(
  cx: number,
  cy: number,
  width: number,
  height: number,
  cssDegrees: number
): { x: number; y: number } {
  const rad = (cssRotationToPdfDegrees(cssDegrees) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx - (width / 2) * cos + (height / 2) * sin,
    y: cy - (width / 2) * sin - (height / 2) * cos,
  };
}
