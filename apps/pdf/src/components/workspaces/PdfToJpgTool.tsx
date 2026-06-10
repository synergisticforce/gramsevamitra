import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { buildPageExportFilename } from '../../lib/fileUtils';
import { canvasToJpegBlob, downloadBlob, loadPdfDocument, renderPdfPageToCanvas } from '../../lib/pdfEngine';

export default function PdfToJpgTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const convert = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a PDF.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const pdf = await loadPdfDocument(selectedFile);
      for (let p = 1; p <= pdf.numPages; p++) {
        report(p - 1, pdf.numPages, `Exporting page ${p} of ${pdf.numPages}…`);
        const canvas = await renderPdfPageToCanvas(selectedFile, p, 2);
        const blob = await canvasToJpegBlob(canvas, 0.92);
        downloadBlob(blob, buildPageExportFilename(selectedFile.name, p, 'jpg'));
      }
      setSuccess(`Exported ${pdf.numPages} JPG page(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [selectedFile, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to export as JPG"
        onFiles={(f) => {
          setSelectedFile(f[0] ?? null);
          setError(null);
          setSuccess(null);
        }}
      />
      <SelectedFileStatus file={selectedFile} />
      <ActionButton onClick={convert} disabled={busy || !selectedFile}>
        {busy ? 'Exporting…' : 'Convert & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
