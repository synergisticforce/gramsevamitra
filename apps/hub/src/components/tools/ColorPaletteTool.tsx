import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractDominantColors,
  generateHarmonizedPalette,
  loadImageToCanvas,
  type ColorSwatch,
  type HarmonyMode,
} from '../../lib/design/colorEngine';

type Mode = 'extract' | 'randomizer';

const HARMONY_MODES: { id: HarmonyMode; label: string }[] = [
  { id: 'monochromatic', label: 'Monochromatic' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'triadic', label: 'Triadic' },
];

export default function ColorPaletteTool() {
  const [mode, setMode] = useState<Mode>('randomizer');
  const [harmony, setHarmony] = useState<HarmonyMode>('complementary');
  const [swatches, setSwatches] = useState<ColorSwatch[]>(() => generateHarmonizedPalette('complementary'));
  const [feedback, setFeedback] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setFeedback(`Copied ${hex}`);
      setTimeout(() => setFeedback(''), 2000);
    } catch {
      setFeedback('Copy failed');
      setTimeout(() => setFeedback(''), 2000);
    }
  }, []);

  const randomize = useCallback(() => {
    setSwatches(generateHarmonizedPalette(harmony));
    setFeedback('');
  }, [harmony]);

  const processImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setFeedback('Please drop an image file.');
      return;
    }
    try {
      const { canvas, imageData } = await loadImageToCanvas(file);
      setSwatches(extractDominantColors(imageData, 5));
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
      setFeedback('Dominant colors extracted from image.');
    } catch {
      setFeedback('Could not process image.');
    }
  }, []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processImage(file);
    },
    [processImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void processImage(file);
    },
    [processImage],
  );

  useEffect(() => {
    if (mode !== 'randomizer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        randomize();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, randomize]);

  useEffect(() => {
    if (!previewUrl || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = previewUrl;
  }, [previewUrl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode('extract')}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            mode === 'extract'
              ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
              : 'border-slate-700 text-slate-400'
          }`}
        >
          Image extractor
        </button>
        <button
          type="button"
          onClick={() => setMode('randomizer')}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
            mode === 'randomizer'
              ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
              : 'border-slate-700 text-slate-400'
          }`}
        >
          Randomizer matrix
        </button>
      </div>

      {mode === 'extract' ? (
        <section
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
            isDragging ? 'border-emerald-500 bg-emerald-950/30' : 'border-slate-700 bg-slate-900/60'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <p className="text-sm text-slate-300">Drag &amp; drop an image here</p>
          <p className="mt-1 text-xs text-slate-500">Processed locally via HTML5 Canvas — never uploaded</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary mt-4 px-4 py-2 text-sm"
          >
            Choose image
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          {previewUrl && (
            <canvas ref={previewCanvasRef} className="mx-auto mt-4 max-h-40 rounded-lg border border-slate-700" />
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">Harmony mode</legend>
              <div className="flex flex-wrap gap-2">
                {HARMONY_MODES.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHarmony(h.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                      harmony === h.id
                        ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
                        : 'border-slate-700 text-slate-400'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <button type="button" onClick={randomize} className="btn-primary px-4 py-2 text-sm">
              Generate (Space)
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">Press Space or click to shuffle a harmonized 5-color palette.</p>
        </section>
      )}

      <p className="min-h-[1.25rem] text-center text-xs text-emerald-400" role="status">
        {feedback}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" role="list" aria-label="Color palette swatches">
        {swatches.map((swatch, idx) => (
          <button
            key={`${swatch.hex}-${idx}`}
            type="button"
            onClick={() => copyHex(swatch.hex)}
            className="swatch-card group flex min-h-[140px] flex-col justify-end overflow-hidden rounded-2xl border border-slate-700/80 shadow-lg transition hover:scale-[1.02] hover:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            style={{ backgroundColor: swatch.hex }}
            title={`Copy ${swatch.hex}`}
          >
            <div className="bg-black/50 px-3 py-2 text-left backdrop-blur-sm">
              <p className="font-mono text-xs font-bold uppercase text-white">{swatch.hex}</p>
              <p className="font-mono text-[10px] text-slate-300">
                rgb({swatch.rgb.r}, {swatch.rgb.g}, {swatch.rgb.b})
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => copyHex(swatches.map((s) => s.hex).join(', '))}
        className="btn-secondary w-full text-sm"
      >
        Copy all HEX values
      </button>

      <style>{`
        .swatch-card { cursor: pointer; }
      `}</style>
    </div>
  );
}
