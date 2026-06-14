import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  businessCardDownloadName,
  DEFAULT_BUSINESS_CARD_INPUT,
  exportBusinessCardPdf,
  exportBusinessCardPng,
  loadBusinessCardInput,
  renderBusinessCardCanvas,
  saveBusinessCardInput,
  triggerBusinessCardDownload,
  type BusinessCardInput,
} from '../../lib/canvas/careerBusinessCard';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function BusinessCardModal({
  onClose,
  onSuccess,
  onProcessingChange,
}: Props) {
  const [form, setForm] = useState<BusinessCardInput>(DEFAULT_BUSINESS_CARD_INPUT);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(loadBusinessCardInput());
  }, []);

  const update = useCallback((patch: Partial<BusinessCardInput>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveBusinessCardInput(next);
      return next;
    });
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const timer = window.setTimeout(() => {
      try {
        const canvas = renderBusinessCardCanvas(form);
        objectUrl = canvas.toDataURL('image/png');
        if (!cancelled) setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form]);

  const downloadName = useMemo(
    () => businessCardDownloadName(form.name, 'png').replace(/\.png$/, ''),
    [form.name]
  );

  const handlePng = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Rendering business card…', 40);
    try {
      const blob = await exportBusinessCardPng(form);
      triggerBusinessCardDownload(blob, `${downloadName}.png`);
      onProcessingChange(false, '', 0);
      onSuccess('Business card PNG downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [downloadName, form, onProcessingChange, onSuccess]);

  const handlePdf = useCallback(async () => {
    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Building print-ready PDF…', 20);
    try {
      onProcessingChange(true, 'Loading PDF engine…', 55);
      const blob = await exportBusinessCardPdf(form);
      onProcessingChange(true, 'Preparing download…', 90);
      triggerBusinessCardDownload(blob, `${downloadName}.pdf`);
      onProcessingChange(false, '', 0);
      onSuccess('Business card PDF downloaded (3.5×2 in).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF export failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [downloadName, form, onProcessingChange, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="biz-card-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="biz-card-title" className="text-lg font-bold text-slate-900">
              🪪 Business Card Generator
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Standard 3.5×2 in card — export PNG or PDF locally via Canvas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {(
              [
                ['name', 'Full name', 'e.g. Priya Sharma'],
                ['title', 'Job title', 'e.g. Software Engineer'],
                ['company', 'Company', 'e.g. GramSeva Mitra'],
                ['email', 'Email', 'you@example.com'],
                ['phone', 'Phone', '+91 98765 43210'],
                ['website', 'Website', 'https://example.com'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </span>
                <input
                  value={form[key]}
                  onChange={(event) => update({ [key]: event.target.value })}
                  placeholder={placeholder}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Accent color
              </span>
              <input
                type="color"
                value={form.accentColor}
                onChange={(event) => update({ accentColor: event.target.value })}
                className="mt-1.5 h-10 w-full cursor-pointer rounded-xl border border-slate-200"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Business card preview"
                  className="mx-auto w-full max-w-md rounded shadow-sm"
                />
              ) : (
                <p className="py-16 text-center text-sm text-slate-500">Generating preview…</p>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePng()}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Download PNG
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePdf()}
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
