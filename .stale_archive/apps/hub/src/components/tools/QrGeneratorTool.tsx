import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'gsm-tools:qr-generator';
const MAX_CHARS = 2048;
const EXPORT_SIZE = 1024;

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

const ERROR_LEVELS: { id: ErrorLevel; label: string; pct: string }[] = [
  { id: 'L', label: 'L', pct: '~7%' },
  { id: 'M', label: 'M', pct: '~15%' },
  { id: 'Q', label: 'Q', pct: '~25%' },
  { id: 'H', label: 'H', pct: '~30%' },
];

export default function QrGeneratorTool() {
  const [text, setText] = useState('');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>('M');
  const [status, setStatus] = useState('');
  const [hasQr, setHasQr] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setText(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const renderQr = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const token = ++renderToken.current;
    const trimmed = text.trim();

    if (!trimmed) {
      setHasQr(false);
      setStatus('');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    if (trimmed.length > MAX_CHARS) {
      setHasQr(false);
      setStatus(`Maximum ${MAX_CHARS} characters.`);
      return;
    }

    setStatus('Generating…');

    try {
      const QRCode = await import('qrcode');
      await QRCode.toCanvas(canvas, trimmed, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: fgColor, light: bgColor },
      });

      if (token !== renderToken.current) return;
      setHasQr(true);
      setStatus(`${trimmed.length} character${trimmed.length === 1 ? '' : 's'} encoded · ECC ${errorLevel}`);
      try {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (token !== renderToken.current) return;
      setHasQr(false);
      setStatus(err instanceof Error ? err.message : 'Could not generate QR code.');
    }
  }, [text, fgColor, bgColor, errorLevel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void renderQr();
    }, 100);
    return () => clearTimeout(timer);
  }, [renderQr]);

  const downloadPng = useCallback(async () => {
    const source = canvasRef.current;
    if (!source || !hasQr) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    ctx.drawImage(source, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const url = exportCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    const slug =
      text
        .trim()
        .slice(0, 32)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'qr-code';
    link.href = url;
    link.download = `${slug}.png`;
    link.click();
  }, [hasQr, bgColor, text]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Content &amp; style</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-canvas-muted">Text or URL</span>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              placeholder="https://gramsevamitra.com or any text…"
              className="input-field min-h-[120px] w-full resize-y leading-relaxed"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-canvas-muted">Foreground</span>
              <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-canvas-border bg-slate-950" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-canvas-muted">Background</span>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-canvas-border bg-slate-950" />
            </label>
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-canvas-muted">Error correction</legend>
            <div className="flex flex-wrap gap-2">
              {ERROR_LEVELS.map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setErrorLevel(lvl.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    errorLevel === lvl.id
                      ? 'border-canvas-accent bg-canvas-accent-soft/50 text-canvas-accent'
                      : 'border-canvas-border text-canvas-subtle'
                  }`}
                >
                  {lvl.label} <span className="text-canvas-subtle">{lvl.pct}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setText('https://gramsevamitra.com')} className="preset-btn">
              gramsevamitra.com
            </button>
            <button
              type="button"
              onClick={() => setText('WIFI:T:WPA;S:MyNetwork;P:password;;')}
              className="preset-btn"
            >
              Wi-Fi sample
            </button>
            <button
              type="button"
              onClick={() => {
                setText('');
                setHasQr(false);
                setStatus('');
              }}
              className="preset-btn border-canvas-border text-canvas-subtle"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6" aria-live="polite">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">QR preview</h2>
        <div className="mt-5 flex flex-col items-center">
          <div
            className="flex min-h-[280px] w-full max-w-[340px] items-center justify-center rounded-2xl border border-canvas-border p-4 shadow-inner"
            style={{ backgroundColor: bgColor }}
          >
            {!hasQr && (
              <p className="px-4 text-center text-sm font-medium leading-relaxed text-slate-200">Enter text to generate your QR code</p>
            )}
            <canvas
              ref={canvasRef}
              width={320}
              height={320}
              className={`max-w-full ${hasQr ? 'block' : 'hidden'}`}
              aria-label="QR code preview"
            />
          </div>
          <p className="mt-3 min-h-[1.25rem] text-center text-xs font-medium leading-relaxed text-slate-300">{status}</p>
          <button type="button" onClick={downloadPng} disabled={!hasQr} className="btn-primary mt-5 w-full max-w-[340px]">
            Download high-res PNG
          </button>
        </div>
      </section>

      <style>{`
        .preset-btn {
          border-radius: 0.5rem;
          border: 1px solid rgba(6, 78, 59, 0.5);
          background: rgba(6, 78, 59, 0.3);
          padding: 0.375rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 500;
          color: rgb(110 231 183);
        }
        .preset-btn:hover { border-color: rgb(16 185 129); color: white; }
      `}</style>
    </div>
  );
}
