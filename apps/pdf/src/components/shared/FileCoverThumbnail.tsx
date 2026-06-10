import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { configurePdfJsWorker, pdfjsLib } from '../../lib/pdfJsWorker';
import { releaseCanvas, renderPdfPageOnCanvas, THUMBNAIL_RENDER_SCALE } from '../../lib/pdfEngine';

export interface MergeFileItem {
  id: string;
  file: File;
  pageCount: number;
}

interface FileCoverThumbnailProps {
  item: MergeFileItem;
  onRemove: (id: string) => void;
}

export function FileCoverThumbnail({ item, onRemove }: FileCoverThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null) as MutableRefObject<HTMLDivElement | null>;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [visible, setVisible] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const renderGenRef = useRef(0);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    containerRef.current = node;
    setNodeRef(node);
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
    let cancelled = false;
    let pdf: PDFDocumentProxy | null = null;

    (async () => {
      try {
        configurePdfJsWorker();
        const data = new Uint8Array(await item.file.arrayBuffer());
        pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
        pdfRef.current = pdf;
        if (cancelled || gen !== renderGenRef.current) return;
        await renderPdfPageOnCanvas(pdf, 1, canvasRef.current!, THUMBNAIL_RENDER_SCALE);
        setLoadError(false);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();

    return () => {
      cancelled = true;
      renderGenRef.current += 1;
      pdf?.destroy();
      pdfRef.current = null;
      releaseCanvas(canvasRef.current);
    };
  }, [visible, item.file, item.id]);

  return (
    <div
      ref={setRefs}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.65 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      className="relative cursor-grab overflow-hidden rounded-xl border-2 border-emerald-900/50 bg-slate-950 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="relative flex min-h-[120px] items-center justify-center bg-white">
        {loadError ? (
          <span className="px-2 text-center text-xs text-slate-500">Preview unavailable</span>
        ) : (
          <canvas ref={canvasRef} className="h-auto max-h-40 w-full object-contain" aria-hidden="true" />
        )}
      </div>

      <div className="space-y-0.5 px-2 py-2">
        <p className="truncate text-xs font-semibold text-white" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="text-[10px] text-emerald-200/80">{item.pageCount} pages</p>
      </div>

      <button
        type="button"
        aria-label={`Remove ${item.file.name}`}
        className="absolute right-2 top-2 rounded-lg bg-slate-900/90 px-2 py-1 text-xs font-bold text-red-300 ring-1 ring-red-800/60 hover:bg-red-950/80"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ✕
      </button>
    </div>
  );
}
