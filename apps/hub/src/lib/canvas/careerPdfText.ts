import { configurePdfJsWorker, pdfjsLib } from '../pdf/pdfJsWorker';

export function isPdfFile(type: string, name: string): boolean {
  return type === 'application/pdf' || /\.pdf$/i.test(name);
}

export function isDocxFile(type: string, name: string): boolean {
  return (
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    type === 'application/msword' ||
    /\.docx?$/i.test(name)
  );
}

/** Extract raw text from a PDF entirely in-browser via pdf.js worker. */
export async function extractTextFromPdfFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  configurePdfJsWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;

  const pages: string[] = [];
  const total = pdf.numPages;

  for (let i = 1; i <= total; i++) {
    onProgress?.(i, total);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(pageText);
  }

  const text = pages.join('\n\n').trim();
  if (!text) {
    throw new Error('No readable text found in this PDF. Try a text-based resume (not a scanned image).');
  }

  return text;
}
