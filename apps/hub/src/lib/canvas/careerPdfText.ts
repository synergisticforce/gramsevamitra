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

async function readZipEntry(buffer: ArrayBuffer, entryName: string): Promise<Uint8Array | null> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break;
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    const dataStart = nameStart + nameLength + extraLength;
    if (flags & 0x08) break;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) break;
    if (name === entryName) {
      const compressed = bytes.subarray(dataStart, dataEnd);
      if (method === 0) return compressed;
      if (method === 8) {
        const compressedStream = new Blob([compressed]).stream() as unknown as {
          pipeThrough: (transform: DecompressionStream) => ReadableStream<Uint8Array>;
        };
        const stream = compressedStream.pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      throw new Error('This Word file uses a compression method the browser cannot read. Save it as PDF.');
    }
    offset = dataEnd;
  }

  return null;
}

/** Read paragraph text from a DOCX file in the browser. Old .doc files are not supported. */
export async function extractTextFromDocxFile(file: File): Promise<string> {
  if (/\.doc$/i.test(file.name) && !/\.docx$/i.test(file.name)) {
    throw new Error('Old .doc files cannot be read in the browser. Save the resume as PDF or DOCX.');
  }
  const xmlBytes = await readZipEntry(await file.arrayBuffer(), 'word/document.xml');
  if (!xmlBytes) {
    throw new Error('Could not read text from this Word file. Save it as PDF and try again.');
  }
  const xml = new TextDecoder().decode(xmlBytes);
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) {
    throw new Error('No readable text found in this Word file.');
  }
  return text;
}

/** Resume text for ATS and Career AI. PDF and DOCX stay on the device. */
export async function extractResumeText(
  file: File,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  if (isPdfFile(file.type, file.name)) {
    return extractTextFromPdfFile(file, onProgress);
  }
  if (isDocxFile(file.type, file.name)) {
    onProgress?.(1, 1);
    return extractTextFromDocxFile(file);
  }
  throw new Error('Upload a PDF or DOCX resume.');
}
