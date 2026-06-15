import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canvasToDataUrl,
  extractLineCanvases,
  imageToCanvas,
  preprocessForOcr,
} from '@shared/utils/ocrPreprocess';
import type { OcrWorkerRequest, OcrWorkerResponse } from '../../lib/ocr/ocrWorkerTypes';

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image.'));
    };
    img.src = url;
  });
}

export default function OcrExtractor() {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelProgress, setModelProgress] = useState<string>('Click “Load OCR model” to download (~150 MB, cached after first use)');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [multiLine, setMultiLine] = useState(true);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../../workers/ocr.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current.onmessage = (event: MessageEvent<OcrWorkerResponse>) => {
        const msg = event.data;
        if (msg.type === 'progress') {
          const pct = msg.progress != null ? ` ${Math.round(msg.progress)}%` : '';
          setModelProgress(`${msg.status}${pct}`);
        } else if (msg.type === 'ready') {
          setModelReady(true);
          setModelProgress('OCR model ready (ONNX / WASM)');
        } else if (msg.type === 'result') {
          setResult(msg.text || '(No text detected)');
          setProcessing(false);
        } else if (msg.type === 'error') {
          setError(msg.message);
          setProcessing(false);
        }
      };
    }
    return workerRef.current;
  }, []);

  const loadModel = useCallback(() => {
    setError(null);
    setModelProgress('Downloading ONNX model…');
    const worker = ensureWorker();
    worker.postMessage({ type: 'init' } satisfies OcrWorkerRequest);
  }, [ensureWorker]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError(null);
    setResult('');
    try {
      const img = await loadImageFromFile(picked);
      const canvas = imageToCanvas(img);
      const processed = preprocessForOcr(canvas);
      setProcessedPreview(processed.toDataURL('image/png'));
      setPreviewUrl(canvas.toDataURL('image/png'));
      setFile(picked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image.');
    }
  }, []);

  const runOcr = useCallback(async () => {
    if (!file || !modelReady) return;
    setProcessing(true);
    setError(null);
    setResult('');

    try {
      const img = await loadImageFromFile(file);
      const canvas = imageToCanvas(img);
      const processed = preprocessForOcr(canvas);

      const lineCanvases = multiLine ? extractLineCanvases(processed) : [processed];
      const dataUrls = await Promise.all(lineCanvases.map((c) => canvasToDataUrl(c)));

      const id = String(++requestIdRef.current);
      const worker = ensureWorker();
      worker.postMessage({ type: 'recognize', id, images: dataUrls } satisfies OcrWorkerRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OCR failed.');
      setProcessing(false);
    }
  }, [file, modelReady, multiLine, ensureWorker]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch {
      setError('Copy failed — select text manually.');
    }
  }, [result]);

  return (
    <div className="ocr-extractor space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-canvas-accent-muted/60 p-5 shadow-none sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Image input</h2>

          <p className="mt-2 text-xs text-canvas-subtle">
            Powered by <strong className="text-canvas-accent/90">Transformers.js</strong> + ONNX Runtime WASM
            (TrOCR). Preprocessing runs on Canvas before inference in a Web Worker.
          </p>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-canvas-muted">Upload image (JPG / PNG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              className="block w-full text-sm text-canvas-subtle file:mr-3 file:rounded-lg file:border-0 file:bg-canvas-accent-muted file:px-4 file:py-2 file:text-sm file:font-semibold file:text-canvas-text hover:file:bg-canvas-accent-soft0"
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-canvas-muted">
            <input
              type="checkbox"
              checked={multiLine}
              onChange={(e) => setMultiLine(e.target.checked)}
              className="accent-emerald-500"
            />
            Split into text lines (better for documents)
          </label>

          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-canvas-subtle">
            {modelProgress}
          </div>

          {!modelReady && (
            <button type="button" onClick={loadModel} className="btn-primary mt-3 w-full text-sm">
              Load OCR model
            </button>
          )}

          <button
            type="button"
            onClick={runOcr}
            disabled={!file || !modelReady || processing}
            className="btn-primary mt-3 w-full text-sm disabled:opacity-50"
          >
            {processing ? 'Extracting text…' : 'Extract text'}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
              {error}
            </p>
          )}

          {previewUrl && processedPreview && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase text-canvas-subtle">Original</p>
                <img src={previewUrl} alt="Original upload" className="max-h-40 w-full rounded-lg border border-slate-800 object-contain" />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase text-canvas-subtle">Preprocessed</p>
                <img src={processedPreview} alt="Preprocessed for OCR" className="max-h-40 w-full rounded-lg border border-slate-800 object-contain" />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-canvas-border bg-gradient-to-br from-emerald-950/50 to-slate-900/60 p-5 shadow-none sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent/80">Extracted text</h2>
            {result && (
              <button type="button" onClick={copyResult} className="rounded-lg border border-emerald-700/60 px-3 py-1 text-xs font-semibold text-canvas-accent hover:border-canvas-accent">
                Copy
              </button>
            )}
          </div>

          <textarea
            readOnly
            value={result}
            rows={16}
            placeholder="OCR output appears here…"
            className="input-field mt-4 w-full resize-y font-mono text-sm leading-relaxed"
          />
        </section>
      </div>
    </div>
  );
}
