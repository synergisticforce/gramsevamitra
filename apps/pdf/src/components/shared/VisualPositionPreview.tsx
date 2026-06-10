import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { releaseCanvas, renderPdfPageOnCanvas, THUMBNAIL_RENDER_SCALE } from '../../lib/pdfEngine';
import {
  OVERLAY_POSITIONS,
  type OverlayPosition,
  type PageNumberHorizontal,
  type PageNumberVertical,
  type WatermarkFontFamily,
  overlayPositionToCss,
  pageNumberPlacementToCss,
} from '../../lib/overlayPosition';

export interface WatermarkPreviewConfig {
  mode: 'text' | 'image';
  text: string;
  color: string;
  fontSize: number;
  fontFamily: WatermarkFontFamily;
  imageUrl: string | null;
  imageScale: number;
  rotation: number;
  opacity: number;
  offsetX: number;
  offsetY: number;
}

export interface PageNumberPreviewConfig {
  text: string;
  color: string;
  fontSize: number;
  fontFamily: WatermarkFontFamily;
  vertical: PageNumberVertical;
  horizontal: PageNumberHorizontal;
  offsetX: number;
  offsetY: number;
}

interface VisualPositionPreviewProps {
  pdf: PDFDocumentProxy | null;
  loading?: boolean;
  overlayType: 'watermark' | 'page-number';
  position: OverlayPosition;
  onPositionChange: (position: OverlayPosition) => void;
  watermark?: WatermarkPreviewConfig;
  pageNumber?: PageNumberPreviewConfig;
}

const FONT_CSS: Record<WatermarkFontFamily, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times Roman': '"Times New Roman", Times, serif',
  Courier: 'Courier, "Courier New", monospace',
};

export default function VisualPositionPreview({
  pdf,
  loading = false,
  overlayType,
  position,
  onPositionChange,
  watermark,
  pageNumber,
}: VisualPositionPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!pdf || !canvasRef.current) {
      setReady(false);
      return;
    }

    let cancelled = false;
    const canvas = canvasRef.current;

    (async () => {
      try {
        await renderPdfPageOnCanvas(pdf, 1, canvas, THUMBNAIL_RENDER_SCALE);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      releaseCanvas(canvas);
    };
  }, [pdf]);

  const watermarkCss =
    overlayType === 'watermark' && watermark
      ? overlayPositionToCss(position, watermark.offsetX * 0.35, watermark.offsetY * 0.35)
      : null;

  const pageNumberCss =
    overlayType === 'page-number' && pageNumber
      ? pageNumberPlacementToCss(
          pageNumber.vertical,
          pageNumber.horizontal,
          pageNumber.offsetX,
          pageNumber.offsetY
        )
      : null;

  const renderWatermark = () => {
    if (!watermark || !watermarkCss) return null;
    const baseStyle: React.CSSProperties = {
      top: watermarkCss.top,
      left: watermarkCss.left,
      right: watermarkCss.right,
      bottom: watermarkCss.bottom,
      transform: [
        watermarkCss.transform !== 'none' ? watermarkCss.transform : '',
        `rotate(${watermark.rotation}deg)`,
      ]
        .filter(Boolean)
        .join(' '),
      transformOrigin: 'center center',
      opacity: watermark.opacity,
      pointerEvents: 'none',
    };

    if (watermark.mode === 'image' && watermark.imageUrl) {
      return (
        <img
          src={watermark.imageUrl}
          alt="Watermark preview"
          className="absolute max-w-[55%] object-contain"
          style={{ ...baseStyle, width: `${watermark.imageScale}%` }}
        />
      );
    }

    return (
      <div
        className="absolute max-w-[80%] truncate font-bold"
        style={{
          ...baseStyle,
          fontSize: `${Math.max(10, watermark.fontSize * 0.45)}px`,
          fontFamily: FONT_CSS[watermark.fontFamily],
          color: watermark.color,
          whiteSpace: 'nowrap',
        }}
      >
        {watermark.text || 'WATERMARK'}
      </div>
    );
  };

  const renderPageNumber = () => {
    if (!pageNumber || !pageNumberCss) return null;
    return (
      <div
        className="absolute max-w-[80%] truncate font-semibold"
        style={{
          top: pageNumberCss.top,
          left: pageNumberCss.left,
          right: pageNumberCss.right,
          bottom: pageNumberCss.bottom,
          transform: pageNumberCss.transform,
          fontSize: `${Math.max(9, pageNumber.fontSize * 0.55)}px`,
          fontFamily: FONT_CSS[pageNumber.fontFamily],
          color: pageNumber.color,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {pageNumber.text || '1'}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="relative mx-auto max-w-md overflow-visible rounded-xl border border-emerald-800/50 bg-slate-950">
        {loading && (
          <p className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80 text-sm text-emerald-200">
            Loading preview…
          </p>
        )}

        <div className="relative overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block w-full" aria-hidden="true" />

          {ready && overlayType === 'watermark' && watermark && renderWatermark()}
          {ready && overlayType === 'page-number' && pageNumber && renderPageNumber()}

          {overlayType === 'watermark' && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
              {OVERLAY_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  aria-label={pos}
                  className={`border border-transparent transition hover:border-emerald-400/50 hover:bg-emerald-500/10 ${
                    position === pos ? 'border-[#10b981]/70 bg-[#10b981]/15 ring-1 ring-[#10b981]/40' : ''
                  }`}
                  onClick={() => onPositionChange(pos)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        {overlayType === 'watermark'
          ? 'Tap a zone on the preview to position your watermark'
          : 'Preview reflects your Top/Bottom and Left/Center/Right placement'}
      </p>
    </div>
  );
}
