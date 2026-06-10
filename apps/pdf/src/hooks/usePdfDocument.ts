import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { configurePdfJsWorker, pdfjsLib } from '../lib/pdfJsWorker';

export function usePdfDocument(file: File | null) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPdf(null);
      setError(null);
      return;
    }

    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        configurePdfJsWorker();
        const data = new Uint8Array(await file.arrayBuffer());
        doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
        if (!cancelled) setPdf(doc);
      } catch (err) {
        if (!cancelled) {
          setPdf(null);
          setError(err instanceof Error ? err.message : 'Failed to load PDF preview.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (doc) {
        void doc.destroy();
      }
      setPdf(null);
    };
  }, [file]);

  return { pdf, loading, error, numPages: pdf?.numPages ?? 0 };
}
