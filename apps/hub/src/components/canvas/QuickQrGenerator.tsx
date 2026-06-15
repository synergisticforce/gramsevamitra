import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

const MAX_CHARS = 2048;
const EXPORT_SIZE = 1024;

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface QrFormState {
  text: string;
  errorLevel: ErrorLevel;
}

const DEFAULTS: QrFormState = {
  text: '',
  errorLevel: 'M',
};

export default function QuickQrGenerator() {
  const initial = useMemo(
    () => loadPersistedJson<QrFormState>(QUICK_TOOLS_STORAGE_KEYS.qrText, DEFAULTS),
    []
  );
  const [text, setText] = useState(initial.text);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>(initial.errorLevel);
  const [status, setStatus] = useState('');
  const [hasQr, setHasQr] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderToken = useRef(0);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.qrText, { text, errorLevel });
  }, [text, errorLevel]);

  const renderQr = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const token = ++renderToken.current;
    const trimmed = text.trim();

    if (!trimmed) {
      setHasQr(false);
      setStatus('');
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        width: 280,
        margin: 2,
        errorCorrectionLevel: errorLevel,
        color: { dark: '#1e293b', light: '#ffffff' },
      });

      if (token !== renderToken.current) return;
      setHasQr(true);
      setStatus(`${trimmed.length} character${trimmed.length === 1 ? '' : 's'} encoded`);
    } catch (err) {
      if (token !== renderToken.current) return;
      setHasQr(false);
      setStatus(err instanceof Error ? err.message : 'Could not generate QR code.');
    }
  }, [text, errorLevel]);

  useEffect(() => {
    const timer = window.setTimeout(() => void renderQr(), 80);
    return () => window.clearTimeout(timer);
  }, [renderQr]);

  const downloadPng = useCallback(() => {
    const source = canvasRef.current;
    if (!source || !hasQr) return;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = EXPORT_SIZE;
    exportCanvas.height = EXPORT_SIZE;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
    ctx.drawImage(source, 0, 0, EXPORT_SIZE, EXPORT_SIZE);

    const link = document.createElement('a');
    const slug =
      text
        .trim()
        .slice(0, 32)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'qr-code';
    link.href = exportCanvas.toDataURL('image/png');
    link.download = `${slug}.png`;
    link.click();
  }, [hasQr, text]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm text-canvas-text outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Content</h2>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-canvas-muted">Text or URL</span>
          <textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="https://gramsevamitra.com or any text…"
            className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
          />
        </label>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-canvas-muted">Error correction</legend>
          <div className="flex flex-wrap gap-2">
            {(['L', 'M', 'Q', 'H'] as ErrorLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setErrorLevel(lvl)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  errorLevel === lvl
                    ? 'border-violet-500 bg-canvas-accent-soft text-violet-800'
                    : 'border-canvas-border text-canvas-muted hover:border-violet-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Preview</h2>
        <div className="mt-4 flex flex-col items-center">
          <div className="flex min-h-[260px] w-full max-w-[300px] items-center justify-center rounded-2xl border border-canvas-border bg-canvas-surface p-4">
            {!hasQr && (
              <p className="px-4 text-center text-sm font-medium leading-relaxed text-slate-200">Enter text to generate your QR code</p>
            )}
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className={`max-w-full ${hasQr ? 'block' : 'hidden'}`}
              aria-label="QR code preview"
            />
          </div>
          <p className="mt-2 min-h-[1.25rem] text-center text-xs font-medium leading-relaxed text-slate-300">{status}</p>
          <button
            type="button"
            onClick={downloadPng}
            disabled={!hasQr}
            className="mt-4 w-full max-w-[300px] rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download PNG
          </button>
        </div>
      </section>
    </div>
  );
}
