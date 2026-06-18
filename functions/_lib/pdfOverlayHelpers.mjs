/** pdf-lib overlay helpers (mirrors apps/hub/src/lib/pdf/pdfOverlay.ts). */

export function formatPageNumber(format, page, total) {
  switch (format) {
    case 'plain':
      return `${page}`;
    case 'page-n':
      return `Page ${page}`;
    case 'n-of-total':
      return `${page} of ${total}`;
    case 'page-n-of-total':
      return `Page ${page} of ${total}`;
    default:
      return `${page}`;
  }
}

const DEFAULT_MARGINS = { top: 36, bottom: 36, left: 36, right: 36 };

export function pageNumberPlacementToPdfCoords(
  vertical,
  horizontal,
  pageWidth,
  pageHeight,
  textWidth,
  fontSize,
  options = {},
) {
  const m = options.margins ?? DEFAULT_MARGINS;
  const fineTuneX = Number(options.offsetX ?? 0);
  const fineTuneY = Number(options.offsetY ?? 0);

  let x;
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
    default:
      x = (pageWidth - textWidth) / 2 + fineTuneX;
  }

  const y =
    vertical === 'top' ? pageHeight - m.top - fontSize + fineTuneY : m.bottom + fineTuneY;
  return { x, y };
}

export function hexToRgb01(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return { r: 0.2, g: 0.2, b: 0.2 };
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

export function overlayPositionToPdfCoords(
  position,
  pageWidth,
  pageHeight,
  contentWidth,
  contentHeight,
  options = {},
) {
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
    default:
      return { x: pageWidth / 2 - contentWidth / 2 + ox, y: pageHeight / 2 - contentHeight / 2 + oy };
  }
}

export function cssRotationToPdfDegrees(cssDegrees) {
  return -cssDegrees;
}

export function bottomLeftForCenterRotation(cx, cy, width, height, cssDegrees) {
  const rad = (cssRotationToPdfDegrees(cssDegrees) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx - (width / 2) * cos + (height / 2) * sin,
    y: cy - (width / 2) * sin - (height / 2) * cos,
  };
}
