import { Document, Packer, Paragraph, TextRun } from 'docx';
import { splitFilenameBase } from './documentPdfTools';

/** Compile plain text into a minimal DOCX blob (client-side, no server). */
export async function textToDocxBlob(text: string, title?: string): Promise<Blob> {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const children =
    blocks.length > 0
      ? blocks.map(
          (block) =>
            new Paragraph({
              children: [new TextRun({ text: block })],
            }),
        )
      : [
          new Paragraph({
            children: [new TextRun({ text: text.trim() || '(empty document)' })],
          }),
        ];

  const doc = new Document({
    title,
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

export function triggerDocxDownload(blob: Blob, baseName: string): void {
  const safe = splitFilenameBase(baseName).replace(/[^\w.-]+/g, '_') || 'extracted';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safe}.docx`;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
