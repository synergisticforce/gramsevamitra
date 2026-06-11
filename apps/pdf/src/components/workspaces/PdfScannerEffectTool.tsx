import { useCallback, useRef, useState } from 'react';
import {
  ActionButton,
  FileDropZone,
  SelectedFileStatus,
  StatusMessage,
} from './ToolWorkspaceShell';
import { toProcessingError } from '../../lib/processingErrors';

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const THRESHOLD = 128;

function applyBwThreshold(source: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
    const value = gray > THRESHOLD ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

async function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load image'));
      el.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Failed to export image'));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      'image/jpeg',
      quality
    );
  });
}

export default function PdfScannerEffectTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const processFile = useCallback(async (selected: File) => {
    setFile(selected);
    setError(null);
    setSuccess(null);

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }

    try {
      const raw = await loadImageToCanvas(selected);
      const scanned = applyBwThreshold(raw);
      const dataUrl = scanned.toDataURL('image/jpeg', 0.92);
      setPreviewUrl(dataUrl);
    } catch {
      setPreviewUrl(null);
    }
  }, []);

  const convert = useCallback(async () => {
    if (!file) {
      setError('Please select an image first.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const raw = await loadImageToCanvas(file);
      const scanned = applyBwThreshold(raw);
      const jpegBytes = await canvasToJpegBytes(scanned, 0.92);

      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const embedded = await pdf.embedJpg(jpegBytes);

      const page = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
      const imgW = embedded.width;
      const imgH = embedded.height;
      const scale = Math.min(A4_WIDTH / imgW, A4_HEIGHT / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const x = (A4_WIDTH - drawW) / 2;
      const y = (A4_HEIGHT - drawH) / 2;

      page.drawImage(embedded, { x, y, width: drawW, height: drawH });

      const out = await pdf.save();
      const base = file.name.replace(/\.[^.]+$/, '') || 'scan';
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}_scanned.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess('Scanned PDF downloaded — image processed locally with B&W threshold.');
    } catch (err) {
      setError(toProcessingError(err));
    } finally {
      setBusy(false);
    }
  }, [file]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="image/jpeg,image/png,image/jpg"
        label="Drop a phone photo (JPG or PNG)"
        onFiles={(files) => {
          const f = files[0];
          if (f) void processFile(f);
        }}
      />
      <SelectedFileStatus file={file} />

      {previewUrl && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</p>
          <img
            src={previewUrl}
            alt="Black and white scan preview"
            className="mx-auto max-h-64 w-auto rounded-lg border border-slate-800"
          />
        </div>
      )}

      <ActionButton onClick={convert} disabled={busy || !file}>
        {busy ? 'Processing…' : 'Convert & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
