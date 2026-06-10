import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageCompareSliderProps {
  original: File | string;
  compressed: Blob | string;
  originalLabel?: string;
  compressedLabel?: string;
  className?: string;
}

export default function ImageCompareSlider({
  original,
  compressed,
  originalLabel = 'Original',
  compressedLabel = 'Compressed',
  className = '',
}: ImageCompareSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);

  useEffect(() => {
    const orig =
      typeof original === 'string' ? original : URL.createObjectURL(original);
    const comp =
      typeof compressed === 'string' ? compressed : URL.createObjectURL(compressed);

    setOriginalUrl(orig);
    setCompressedUrl(comp);

    return () => {
      if (typeof original !== 'string') URL.revokeObjectURL(orig);
      if (typeof compressed !== 'string') URL.revokeObjectURL(comp);
    };
  }, [original, compressed]);

  const updatePosition = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => updatePosition(e.clientX);
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, updatePosition]);

  if (!originalUrl || !compressedUrl) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <span>{originalLabel}</span>
        <span>{compressedLabel}</span>
      </div>

      <div
        ref={containerRef}
        className="relative aspect-[3/4] max-h-80 w-full select-none overflow-hidden rounded-xl border border-slate-700 bg-slate-950 touch-none"
        onPointerDown={(e) => {
          setDragging(true);
          updatePosition(e.clientX);
        }}
        role="slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Compare original and compressed image quality"
      >
        <img
          src={originalUrl}
          alt="Original"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        <img
          src={compressedUrl}
          alt="Compressed"
          className="absolute inset-0 h-full w-full object-contain"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
          draggable={false}
        />

        <div
          className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)]"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        />

        <div
          className="pointer-events-none absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-emerald-600/90 text-sm font-bold text-white shadow-lg"
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          ⇔
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">Drag the slider to compare quality retention</p>
    </div>
  );
}
