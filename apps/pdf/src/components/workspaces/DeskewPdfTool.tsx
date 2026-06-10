import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import {
  canvasToJpegBlob,
  downloadBytes,
  loadPdfDocument,
  renderPdfPageToCanvas,
  rotateCanvas,
} from '../../lib/pdfEngine';

export default function DeskewPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [degrees, setDegrees] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const straighten = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF or image.');
      return;
    }
    if (degrees === 0) {
      setError('Adjust the rotation angle first.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const { PDFDocument } = await import('pdf-lib');
      const outDoc = await PDFDocument.create();

      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(img.src);
        const rotated = rotateCanvas(canvas, degrees);
        const blob = await canvasToJpegBlob(rotated, 0.92);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const embedded = await outDoc.embedJpg(bytes);
        const page = outDoc.addPage([embedded.width, embedded.height]);
        page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
      } else {
        const pdf = await loadPdfDocument(file);
        for (let p = 1; p <= pdf.numPages; p++) {
          const canvas = await renderPdfPageToCanvas(file, p, 1.5);
          const rotated = rotateCanvas(canvas, degrees);
          const blob = await canvasToJpegBlob(rotated, 0.9);
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const embedded = await outDoc.embedJpg(bytes);
          const page = outDoc.addPage([embedded.width, embedded.height]);
          page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
        }
      }

      const out = await outDoc.save();
      downloadBytes(out, file.name, 'application/pdf', '_straightened');
      setSuccess(`Saved with ${degrees}° rotation.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deskew failed.');
    } finally {
      setBusy(false);
    }
  }, [file, degrees]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf,image/jpeg,image/png"
        label="Upload tilted scan or photo"
        onFiles={(f) => setFile(f[0] ?? null)}
      />
      <SelectedFileStatus file={file} />
      <label className="block">
        <span className="label text-emerald-200">Rotation: {degrees}°</span>
        <input
          type="range"
          min={-45}
          max={45}
          step={1}
          value={degrees}
          onChange={(e) => setDegrees(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
      </label>
      <ActionButton onClick={straighten} disabled={busy || !file}>
        {busy ? 'Straightening…' : 'Apply & Download PDF'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
