import { useRef, useState } from 'react';
import {
  aiConverterService,
  type SavedConversion,
  type TargetFormat,
} from '../../../shared/services/AiConverterService';
import ProBadge from '../../../shared/components/ProBadge';

const FORMATS: { id: TargetFormat; label: string; hint: string }[] = [
  { id: 'docx', label: '.docx', hint: 'Layout-perfect Word' },
  { id: 'xlsx', label: '.xlsx', hint: 'Editable spreadsheet' },
  { id: 'csv', label: '.csv', hint: 'Plain table export' },
];

export interface ConverterScreenProps {
  onBack?: () => void;
  onOpenVault?: (vaultId: string, fileName: string) => void;
}

export default function ConverterScreen({ onBack, onOpenVault }: ConverterScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<TargetFormat>('docx');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedConversion | null>(null);

  const handleConvert = async () => {
    if (!file) {
      setError('Choose a PDF or image first.');
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(null);
    setProgress('Uploading document to secure AI pipeline…');

    try {
      const jobId = await aiConverterService.startConversion(file, format);
      setProgress('AI processing layout, tables, and formatting…');

      const job = await aiConverterService.pollUntilComplete(jobId, {
        onTick: (tick) => {
          if (tick.status === 'processing') {
            setProgress('AI processing layout, tables, and formatting…');
          } else if (tick.status === 'pending') {
            setProgress('Queued — preparing Vision reconstruction…');
          }
        },
      });

      if (job.status === 'failed') {
        throw new Error(job.error || 'AI conversion failed.');
      }

      setProgress('Building editable file and saving to Local Vault…');
      const material = await aiConverterService.materializeBlob(job);
      const result = await aiConverterService.saveConvertedFile(
        material.blob,
        material.fileName,
        material.mimeType,
      );
      setSaved(result);
      setProgress('Conversion complete.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Conversion failed.';
      console.warn('[ConverterScreen]', message);
      setError(message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadCopy = async () => {
    if (!saved) return;
    await aiConverterService.saveConvertedFile(saved.blob, saved.fileName, saved.mimeType, {
      forceDownload: true,
    });
  };

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-300 transition hover:bg-canvas-elevated hover:text-canvas-text"
              >
                ← Back
              </button>
            ) : null}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
              AI Convert
            </p>
          </div>
          <ProBadge />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">
          Convert to editable file
        </h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Turn a scanned PDF or photo into Word, Excel, or CSV while preserving tables and layout —
          works on Android vault and PWA download.
        </p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp"
        className="hidden"
        onChange={(event) => {
          const next = event.target.files?.[0] ?? null;
          setFile(next);
          setSaved(null);
          setError(null);
          setProgress(null);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full flex-col items-start gap-1 rounded-2xl border border-dashed border-canvas-border bg-canvas-surface px-5 py-5 text-left transition hover:border-canvas-accent/50 hover:bg-canvas-elevated disabled:opacity-60"
      >
        <span className="text-sm font-bold text-canvas-text">
          {file ? file.name : 'Choose PDF or image'}
        </span>
        <span className="text-xs font-medium text-slate-300">
          {file
            ? `${Math.max(1, Math.round(file.size / 1024))} KB selected`
            : 'Camera scans and phone photos work best'}
        </span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {FORMATS.map((item) => {
          const active = format === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={busy}
              onClick={() => setFormat(item.id)}
              className={`rounded-xl border px-3 py-3 text-center transition disabled:opacity-60 ${
                active
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-100'
                  : 'border-canvas-border bg-canvas-surface text-slate-300 hover:bg-canvas-elevated'
              }`}
            >
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="mt-0.5 block text-[10px] font-medium opacity-80">{item.hint}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void handleConvert()}
        disabled={busy || !file}
        className="inline-flex w-full items-center justify-center rounded-2xl bg-canvas-accent-muted px-6 py-4 text-base font-bold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Converting…' : `Convert to ${format.toUpperCase()}`}
      </button>

      {progress && (
        <div
          className="rounded-xl border border-emerald-500/30 bg-canvas-accent-soft px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-canvas-border">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-400/80" />
          </div>
          <p className="text-sm font-medium text-canvas-text">{progress}</p>
        </div>
      )}

      {saved && (
        <div className="space-y-3 rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-4">
          <p className="text-sm font-semibold text-canvas-text">
            Saved: <span className="text-emerald-300">{saved.fileName}</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onOpenVault?.(saved.vaultId, saved.fileName)}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-bold text-canvas-text transition hover:bg-canvas-accent-muted"
            >
              Open in Local Vault
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadCopy()}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/20"
            >
              Download Copy
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-4 py-3 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
