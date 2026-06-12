import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { buildPageExportFilename } from '../../lib/fileUtils';
import {
  canvasToJpegBlob,
  downloadBlob,
  downloadBytes,
  fileToDataUrl,
  loadPdfDocument,
  renderPdfPageToCanvas,
} from '../../lib/pdfEngine';
import { runPdfWorker } from '../../lib/pdfWorkerClient';

function usePdfToolState() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();
  return { file, setFile, busy, setBusy, error, setError, success, setSuccess, report, resetProgress };
}

export function RepairPdfTool() {
  const s = usePdfToolState();

  const run = useCallback(async () => {
    if (!s.file) return s.setError('Select a PDF.');
    s.setBusy(true);
    s.setError(null);
    try {
      const out = await runPdfWorker<Uint8Array>(
        'repair',
        { buffer: await s.file.arrayBuffer() },
        ({ current, total, label }) => s.report(current, total, label)
      );
      downloadBytes(out, s.file.name, 'application/pdf', '_repaired');
      s.setSuccess('PDF structure rebuilt successfully.');
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Repair failed.');
    } finally {
      s.resetProgress();
      s.setBusy(false);
    }
  }, [s]);

  return (
    <ToolShell
      accept="application/pdf"
      label="Upload PDF to repair"
      file={s.file}
      onFiles={(f) => s.setFile(f[0] ?? null)}
      action="Repair & Download"
      busy={s.busy}
      onAction={run}
      error={s.error}
      success={s.success}
    />
  );
}

export function PngToPdfTool() {
  return <ImagesToPdfTool accept="image/png" label="Select PNG images" kind="png" />;
}

export function HeicToPdfTool() {
  return <ImagesToPdfTool accept="image/heic,image/heif,.heic,.heif" label="Select HEIC photos" kind="jpg" />;
}

function ImagesToPdfTool({
  accept,
  label,
  kind,
}: {
  accept: string;
  label: string;
  kind: 'jpg' | 'png';
}) {
  const s = usePdfToolState();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const run = useCallback(async () => {
    if (!selectedFiles.length) return s.setError('Select at least one image.');
    s.setBusy(true);
    s.setError(null);
    try {
      const images: { bytes: Uint8Array; kind: 'jpg' | 'png' }[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        s.report(i, selectedFiles.length, `Processing image ${i + 1} of ${selectedFiles.length}…`);
        const file = selectedFiles[i];
        let bytes: Uint8Array;
        let imageKind: 'jpg' | 'png' = kind;

        if (file.type.includes('heic') || file.name.toLowerCase().endsWith('.heic')) {
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
          const blob = await canvasToJpegBlob(canvas, 0.92);
          bytes = new Uint8Array(await blob.arrayBuffer());
          imageKind = 'jpg';
        } else if (kind === 'png') {
          bytes = new Uint8Array(await file.arrayBuffer());
        } else {
          const dataUrl = await fileToDataUrl(file);
          const res = await fetch(dataUrl);
          bytes = new Uint8Array(await res.arrayBuffer());
          imageKind = file.type === 'image/png' ? 'png' : 'jpg';
        }
        images.push({ bytes, kind: imageKind });
      }

      const out = await runPdfWorker<Uint8Array>(
        'images-to-pdf',
        { images },
        ({ current, total, label: l }) => s.report(current, total, l)
      );
      downloadBytes(out, 'images-to-pdf.pdf', 'application/pdf', '_converted');
      s.setSuccess(`Created PDF from ${selectedFiles.length} image(s).`);
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      s.resetProgress();
      s.setBusy(false);
    }
  }, [s, kind, selectedFiles]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept={accept}
        multiple
        label={label}
        onFiles={(files) => {
          setSelectedFiles(files);
          s.setError(null);
          s.setSuccess(null);
        }}
      />
      <SelectedFileStatus files={selectedFiles} />
      <ActionButton onClick={run} disabled={s.busy || !selectedFiles.length}>
        {s.busy ? 'Converting…' : 'Convert & Download'}
      </ActionButton>
      <StatusMessage error={s.error} success={s.success} />
    </div>
  );
}

export function WordToPdfTool() {
  const s = usePdfToolState();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const run = useCallback(async () => {
    if (!selectedFile) return s.setError('Select a .txt file.');
    s.setBusy(true);
    s.setError(null);
    try {
      const text = await selectedFile.text();
      const { PDFDocument, StandardFonts } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const lines = text.match(/.{1,90}(\s|$)/g) ?? [text];
      let page = doc.addPage();
      let y = page.getHeight() - 40;
      for (const line of lines) {
        if (y < 40) {
          page = doc.addPage();
          y = page.getHeight() - 40;
        }
        page.drawText(line.trim(), { x: 40, y, size: 11, font });
        y -= 16;
      }
      downloadBytes(await doc.save(), 'document.pdf', 'application/pdf', '_converted');
      s.setSuccess('Text document converted to PDF.');
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Conversion failed.');
    } finally {
      s.setBusy(false);
    }
  }, [s, selectedFile]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept=".txt,text/plain"
        label="Select .txt file"
        onFiles={(files) => {
          setSelectedFile(files[0] ?? null);
          s.setError(null);
          s.setSuccess(null);
        }}
      />
      <SelectedFileStatus file={selectedFile} />
      <ActionButton onClick={run} disabled={s.busy || !selectedFile}>
        {s.busy ? 'Converting…' : 'Convert & Download'}
      </ActionButton>
      <p className="text-xs text-slate-400">For Word files, save as .txt first or use Type & Save as PDF.</p>
      <StatusMessage error={s.error} success={s.success} />
    </div>
  );
}

export function TextToPdfTool() {
  const s = usePdfToolState();
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadTextFile = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      setSelectedFile(file);
      s.setError(null);
      s.setSuccess(null);
      try {
        setText(await file.text());
      } catch {
        s.setError('Could not read the text file.');
        setText('');
      }
    },
    [s]
  );

  const run = useCallback(async () => {
    if (!text.trim()) return s.setError('Type, paste, or upload some text first.');
    s.setBusy(true);
    s.setError(null);
    s.setSuccess(null);
    try {
      const { PDFDocument, StandardFonts } = await import('pdf-lib');
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const lines = text.split('\n');
      let page = doc.addPage();
      let y = page.getHeight() - 40;
      for (const line of lines) {
        if (y < 40) {
          page = doc.addPage();
          y = page.getHeight() - 40;
        }
        page.drawText(line.slice(0, 100), { x: 40, y, size: 12, font });
        y -= 18;
      }
      downloadBytes(await doc.save(), 'typed-document.pdf', 'application/pdf', '_typed');
      s.setSuccess('PDF created from your text.');
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      s.setBusy(false);
    }
  }, [s, text]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept=".txt,text/plain"
        label="Or upload a .txt file to load into the editor"
        onFiles={loadTextFile}
      />
      <SelectedFileStatus file={selectedFile} />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          s.setError(null);
          s.setSuccess(null);
        }}
        rows={8}
        placeholder="Type declaration, address, or notes here…"
        className="input-field border-emerald-800/60 bg-slate-950 text-white focus:border-emerald-400"
      />
      <ActionButton onClick={run} disabled={s.busy || !text.trim()}>
        {s.busy ? 'Saving…' : 'Save as PDF'}
      </ActionButton>
      <StatusMessage error={s.error} success={s.success} />
    </div>
  );
}

export function PdfToPngTool() {
  const s = usePdfToolState();

  const run = useCallback(async () => {
    if (!s.file) return s.setError('Select a PDF.');
    s.setBusy(true);
    try {
      const pdf = await loadPdfDocument(s.file);
      for (let p = 1; p <= pdf.numPages; p++) {
        s.report(p - 1, pdf.numPages, `Exporting page ${p} of ${pdf.numPages}…`);
        const canvas = await renderPdfPageToCanvas(s.file, p, 2);
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/png');
        });
        downloadBlob(blob, buildPageExportFilename(s.file.name, p, 'png'));
      }
      s.setSuccess(`Exported ${pdf.numPages} PNG page(s).`);
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      s.resetProgress();
      s.setBusy(false);
    }
  }, [s]);

  return (
    <ToolShell
      accept="application/pdf"
      label="Select PDF to export as PNG"
      file={s.file}
      onFiles={(f) => s.setFile(f[0] ?? null)}
      action="Convert & Download"
      busy={s.busy}
      onAction={run}
      error={s.error}
      success={s.success}
    />
  );
}

export function PdfToWordTool() {
  const s = usePdfToolState();

  const run = useCallback(async () => {
    if (!s.file) return s.setError('Select a PDF.');
    s.setBusy(true);
    try {
      const pdf = await loadPdfDocument(s.file);
      const parts: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        s.report(p - 1, pdf.numPages, `Extracting page ${p} of ${pdf.numPages}…`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        parts.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
      }
      const blob = new Blob([parts.join('\n\n')], { type: 'text/plain' });
      downloadBlob(blob, s.file.name.replace(/\.pdf$/i, '.txt'), '_extracted');
      s.setSuccess('Text exported as editable .txt file.');
    } catch (e) {
      s.setError(e instanceof Error ? e.message : 'Extract failed.');
    } finally {
      s.resetProgress();
      s.setBusy(false);
    }
  }, [s]);

  return (
    <ToolShell
      accept="application/pdf"
      label="Select PDF to extract as text"
      file={s.file}
      onFiles={(f) => s.setFile(f[0] ?? null)}
      action="Convert & Download"
      busy={s.busy}
      onAction={run}
      error={s.error}
      success={s.success}
    />
  );
}

function ToolShell({
  accept,
  label,
  file,
  onFiles,
  action,
  busy,
  onAction,
  error,
  success,
}: {
  accept: string;
  label: string;
  file: File | null;
  onFiles: (files: File[]) => void;
  action: string;
  busy: boolean;
  onAction: () => void;
  error: string | null;
  success: string | null;
}) {
  return (
    <div className="space-y-4">
      <FileDropZone accept={accept} label={label} onFiles={onFiles} />
      <SelectedFileStatus file={file} />
      <ActionButton onClick={onAction} disabled={busy || !file}>
        {busy ? 'Processing…' : action}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
