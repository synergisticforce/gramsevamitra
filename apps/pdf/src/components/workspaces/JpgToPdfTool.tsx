import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { downloadBytes, fileToDataUrl } from '../../lib/pdfEngine';
import { runPdfWorker } from '../../lib/pdfWorkerClient';

export default function JpgToPdfTool() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const convert = useCallback(async () => {
    if (!selectedFiles.length) {
      setError('Please select at least one image.');
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const images: { bytes: Uint8Array; kind: 'jpg' | 'png' }[] = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        report(i, selectedFiles.length, `Processing image ${i + 1} of ${selectedFiles.length}…`);
        const file = selectedFiles[i];
        const dataUrl = await fileToDataUrl(file);
        const res = await fetch(dataUrl);
        const bytes = new Uint8Array(await res.arrayBuffer());
        images.push({
          bytes,
          kind: file.type === 'image/png' ? 'png' : 'jpg',
        });
      }

      const out = await runPdfWorker<Uint8Array>(
        'images-to-pdf',
        { images },
        ({ current, total, label }) => report(current, total, label)
      );

      downloadBytes(out, 'photos-to-pdf.pdf', 'application/pdf', '_converted');
      setSuccess(`Created PDF from ${selectedFiles.length} image(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [selectedFiles, report, resetProgress]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="image/jpeg,image/png,image/jpg"
        multiple
        label="Select JPG / JPEG photos"
        onFiles={(files) => {
          setSelectedFiles(files);
          setError(null);
          setSuccess(null);
        }}
      />
      <SelectedFileStatus files={selectedFiles} />
      <ActionButton onClick={convert} disabled={busy || !selectedFiles.length}>
        {busy ? 'Converting…' : 'Convert & Download'}
      </ActionButton>
      <StatusMessage error={error} success={success} />
    </div>
  );
}
