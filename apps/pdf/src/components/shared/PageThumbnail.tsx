import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { releaseCanvas, renderPdfPageOnCanvas, THUMBNAIL_RENDER_SCALE } from '../../lib/pdfEngine';
import type { PageGroup, PageRotation, VisualGridMode } from '../../lib/visualPageTypes';
import { cycleRotation } from '../../lib/visualPageTypes';

interface PageThumbnailProps {
  pdf: PDFDocumentProxy;
  pageNum: number;
  mode: VisualGridMode;
  rotation: PageRotation;
  removed: boolean;
  group?: PageGroup | null;
  selected?: boolean;
  sortable?: boolean;
  onRotationChange?: (pageNum: number, rotation: PageRotation) => void;
  onRemovedToggle?: (pageNum: number) => void;
  onPageClick?: (pageNum: number, shiftKey: boolean) => void;
}

export function PageThumbnail({
  pdf,
  pageNum,
  mode,
  rotation,
  removed,
  group,
  selected = false,
  sortable = false,
  onRotationChange,
  onRemovedToggle,
  onPageClick,
}: PageThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const renderGenRef = useRef(0);

  const isSortable = sortable && (mode === 'reorder' || mode === 'organize');

  const sortableProps = useSortable({
    id: String(pageNum),
    disabled: !isSortable,
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortableProps;

  const setRefs = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (isSortable) setNodeRef(node);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px', threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const gen = ++renderGenRef.current;
    const canvas = canvasRef.current;

    (async () => {
      try {
        await renderPdfPageOnCanvas(pdf, pageNum, canvas, THUMBNAIL_RENDER_SCALE);
      } catch {
        if (gen === renderGenRef.current) releaseCanvas(canvas);
      }
    })();

    return () => {
      renderGenRef.current += 1;
      releaseCanvas(canvas);
    };
  }, [visible, pdf, pageNum]);

  const borderClass = group
    ? group.borderClass
    : selected
      ? 'border-[#10b981]'
      : 'border-emerald-900/40';

  const style = isSortable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 20 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setRefs}
      style={style}
      className={`relative overflow-hidden rounded-xl border-2 bg-slate-950 transition ${borderClass} ${
        removed ? 'opacity-50' : ''
      } ${isSortable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      {...(isSortable ? { ...attributes, ...listeners } : {})}
      onClick={(e) => {
        if (mode === 'organize') {
          onRotationChange?.(pageNum, cycleRotation(rotation));
          return;
        }
        if (mode === 'group-select' || mode === 'view') {
          onPageClick?.(pageNum, e.shiftKey);
        }
      }}
    >
      <div
        className="relative flex items-center justify-center bg-white"
        style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease' }}
      >
        <canvas ref={canvasRef} className="h-auto max-h-44 w-full object-contain" aria-hidden="true" />
        {removed && (
          <div className="pointer-events-none absolute inset-0 bg-red-950/35 backdrop-blur-[1px]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom right, transparent calc(50% - 2px), rgb(239 68 68) calc(50% - 2px), rgb(239 68 68) calc(50% + 2px), transparent calc(50% + 2px))',
              }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <span className="text-xs font-semibold text-slate-300">Page {pageNum}</span>
        {group && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${group.badgeClass}`}>
            {group.label}
          </span>
        )}
      </div>

      {(mode === 'rotate' || mode === 'organize') && (
        <button
          type="button"
          className="absolute left-2 top-2 rounded-lg bg-slate-900/85 px-2 py-1 text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-700/60"
          onClick={(e) => {
            e.stopPropagation();
            onRotationChange?.(pageNum, cycleRotation(rotation));
          }}
        >
          ↻ {rotation}°
        </button>
      )}

      {(mode === 'remove' || mode === 'organize') && (
        <button
          type="button"
          aria-label={removed ? `Restore page ${pageNum}` : `Mark page ${pageNum} for removal`}
          className={`absolute right-2 top-2 rounded-lg px-2 py-1 text-xs font-bold ring-1 ${
            removed
              ? 'bg-red-900/80 text-red-200 ring-red-700'
              : 'bg-slate-900/85 text-slate-300 ring-slate-600 hover:text-red-300'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onRemovedToggle?.(pageNum);
          }}
        >
          {removed ? '↩' : '🗑'}
        </button>
      )}
    </div>
  );
}
