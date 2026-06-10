import { useCallback, useState } from 'react';
import { ActionButton, FileDropZone, SelectedFileStatus, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import { loadPdfDocument } from '../../lib/pdfEngine';

export default function PdfToTextTool() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { report, resetProgress } = useToolProgress();

  const extract = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select a PDF.');
      return;
    }
    setBusy(true);
    setError(null);
    setText('');

    try {
      const pdf = await loadPdfDocument(selectedFile);
      const parts: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        report(p - 1, pdf.numPages, `Reading page ${p} of ${pdf.numPages}…`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
        parts.push(`--- Page ${p} ---\n${pageText}`);
      }
      setText(parts.join('\n\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Text extraction failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [selectedFile, report, resetProgress]);

  const copyText = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  }, [text]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to extract text"
        onFiles={(f) => {
          setSelectedFile(f[0] ?? null);
          setError(null);
          setText('');
        }}
      />
      <SelectedFileStatus file={selectedFile} />
      <ActionButton onClick={extract} disabled={busy || !selectedFile}>
        {busy ? 'Extracting…' : 'Extract Text'}
      </ActionButton>
      <StatusMessage error={error} />
      {text && (
        <>
          <textarea
            readOnly
            value={text}
            rows={12}
            className="input-field border-emerald-800/60 bg-slate-950 font-mono text-xs text-white focus:border-emerald-400"
          />
          <ActionButton onClick={copyText}>Copy to Clipboard</ActionButton>
        </>
      )}
    </div>
  );
}
