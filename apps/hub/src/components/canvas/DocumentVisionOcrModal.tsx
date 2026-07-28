import { useCallback, useEffect, useRef, useState } from 'react';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import { parseCreditApiError } from '../../lib/auth/creditCheck';
import { useProCreditConfirm } from '../../lib/auth/useProCreditConfirm';

const ENDPOINT = '/api/pro/document-ocr';
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp';
const MAX_BYTES = 12 * 1024 * 1024;

interface Props {
  /** Optional file already on the Document Studio canvas. */
  initialFile?: File | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

interface DocumentOcrResponse {
  success?: boolean;
  markdown?: string;
  fileName?: string;
  model?: string;
  processingMs?: number;
  creditsUsed?: number;
  remainingCredits?: number;
  message?: string;
  error?: string;
  requiredCredits?: number;
}

function splitFilenameBase(name: string): string {
  const trimmed = name.trim() || 'document';
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0) return trimmed;
  return trimmed.slice(0, dot);
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return true;
  if (type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp)$/.test(name);
}

export default function DocumentVisionOcrModal({ initialFile = null, onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<number | null>(null);
  const { requestProConfirm, proCreditModal } = useProCreditConfirm();

  const [file, setFile] = useState<File | null>(initialFile);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current != null) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  const stopProgressPulse = useCallback(() => {
    if (progressTimerRef.current != null) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const startProgressPulse = useCallback(() => {
    stopProgressPulse();
    setProgress(8);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const step = prev < 40 ? 6 : prev < 70 ? 3 : 1;
        return Math.min(88, prev + step);
      });
    }, 450);
  }, [stopProgressPulse]);

  const assignFile = useCallback((next: File | null) => {
    setError(null);
    setMarkdown(null);
    setCopyDone(false);
    setFile(next);
  }, []);

  const onPickFile = useCallback(
    (list: FileList | null) => {
      const picked = list?.[0];
      if (!picked) return;
      if (!isAcceptedFile(picked)) {
        setError('Please choose a PDF or image (JPG, PNG, or WEBP).');
        return;
      }
      if (picked.size > MAX_BYTES) {
        setError(`This file is too large (max ${Math.floor(MAX_BYTES / (1024 * 1024))} MB).`);
        return;
      }
      assignFile(picked);
    },
    [assignFile],
  );

  const executeOcr = useCallback(async () => {
    if (!file) {
      setError('Tap below to upload a PDF or image first.');
      return;
    }

    setBusy(true);
    setError(null);
    setMarkdown(null);
    setCopyDone(false);
    startProgressPulse();

    try {
      const form = new FormData();
      form.append('file', file, file.name);

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });

      const payload = (await response.json()) as DocumentOcrResponse;

      if (response.status === 401 || response.status === 403) {
        openProUpgrade({
          featureId: 'document-ocr',
          featureName: 'Vision AI Document Reader',
          featureDescription:
            payload.message ??
            'Pro members can extract layout-perfect Markdown from PDFs and scanned images.',
        });
        return;
      }

      if (response.status === 402) {
        setError(parseCreditApiError(response.status, payload, 'Insufficient AI Credits.'));
        return;
      }

      if (!response.ok || !payload.success || typeof payload.markdown !== 'string') {
        setError(
          parseCreditApiError(
            response.status,
            payload,
            'Vision AI could not read this document. Please try again.',
          ),
        );
        return;
      }

      setProgress(100);
      setMarkdown(payload.markdown);
      onSuccess?.('Vision AI finished — your text is ready below.');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      stopProgressPulse();
      setBusy(false);
    }
  }, [file, onSuccess, startProgressPulse, stopProgressPulse]);

  const runOcr = useCallback(() => {
    setError(null);
    if (!file) {
      setError('Tap below to upload a PDF or image first.');
      return;
    }
    void requestProConfirm('document-ocr', 'Vision AI Document Reader', () => {
      void executeOcr();
    });
  }, [executeOcr, file, requestProConfirm]);

  const copyMarkdown = useCallback(async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setError('Could not copy. Select the text and copy manually.');
    }
  }, [markdown]);

  const downloadMarkdown = useCallback(() => {
    if (!markdown) return;
    const base = splitFilenameBase(file?.name || 'document');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${base}_vision.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }, [file?.name, markdown]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-ocr-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-canvas-border bg-canvas-surface shadow-none sm:max-h-[90vh] sm:rounded-2xl">
        <div className="shrink-0 border-b border-canvas-border px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Pro · Vision AI</p>
              <h2 id="vision-ocr-title" className="mt-0.5 text-lg font-bold text-canvas-text">
                Layout &amp; Text Extract
              </h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                Reads your PDF or photo and returns clean Markdown — tables kept tidy.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted disabled:opacity-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {!markdown && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  onPickFile(event.dataTransfer.files);
                }}
                className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-10 text-center transition active:scale-[0.99] disabled:opacity-60 ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-950/30'
                    : 'border-canvas-border bg-canvas-elevated hover:border-emerald-500/50'
                }`}
              >
                <span className="text-3xl" aria-hidden="true">
                  📄
                </span>
                <span className="mt-3 text-base font-semibold text-canvas-text">
                  Tap to Upload PDF or Image
                </span>
                <span className="mt-1 max-w-xs text-xs font-medium leading-relaxed text-slate-300">
                  Your file is sent only for this Pro Vision AI job. Max {Math.floor(MAX_BYTES / (1024 * 1024))} MB.
                </span>
                {file && (
                  <span className="mt-3 rounded-lg bg-canvas-surface px-3 py-1.5 text-xs font-semibold text-canvas-muted">
                    {file.name} · {formatBytes(file.size)}
                  </span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  onPickFile(event.target.files);
                  event.target.value = '';
                }}
              />

              {busy && (
                <div className="mt-4 rounded-xl border border-amber-800/40 bg-amber-950/40 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-100">
                    Vision AI analyzing layout &amp; text…
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas-elevated">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-300">
                    Please keep this tab open. Slow networks may take a minute.
                  </p>
                </div>
              )}
            </>
          )}

          {markdown && (
            <div className="space-y-3 pb-24">
              <p className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Results
              </p>
              <pre className="whitespace-pre-wrap break-words rounded-xl border border-canvas-border bg-canvas-elevated p-3 font-sans text-sm leading-relaxed text-canvas-text">
                {markdown}
              </pre>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-sm font-medium text-rose-100">
              {error}
            </p>
          )}
        </div>

        {/* Thumb-zone primary actions */}
        <div className="sticky bottom-0 shrink-0 border-t border-canvas-border bg-canvas-surface/95 px-4 py-3 backdrop-blur-sm sm:px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {markdown ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyMarkdown()}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-canvas-border bg-canvas-elevated px-3 text-sm font-semibold text-canvas-text transition hover:border-emerald-500/50"
              >
                {copyDone ? 'Copied' : 'Copy Text'}
              </button>
              <button
                type="button"
                onClick={downloadMarkdown}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Download as .md
              </button>
              <button
                type="button"
                onClick={() => {
                  setMarkdown(null);
                  setProgress(0);
                  setError(null);
                }}
                className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-xl border border-canvas-border px-3 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
              >
                Extract another file
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={runOcr}
              disabled={busy || !file}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-700 px-4 text-sm font-semibold text-amber-50 transition hover:bg-amber-600 disabled:opacity-50"
            >
              {busy ? 'Analyzing…' : 'Extract with Vision AI ⚡'}
            </button>
          )}
        </div>
      </div>

      {proCreditModal}
    </div>
  );
}
