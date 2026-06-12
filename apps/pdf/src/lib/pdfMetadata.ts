import { configurePdfJsWorker, pdfjsLib } from './pdfJsWorker';

export interface PdfMetadataInfo {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
  creationDate: string | null;
  modificationDate: string | null;
}

function formatPdfDate(date: Date | undefined): string | null {
  if (!date) return null;
  try {
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

function displayValue(value: string | string[] | undefined | null): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value).trim();
}

/** Read document info dictionary fields for preview before stripping. */
export async function readPdfMetadata(file: File): Promise<PdfMetadataInfo> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const buffer = await file.arrayBuffer();
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });

  return {
    title: displayValue(doc.getTitle()),
    author: displayValue(doc.getAuthor()),
    subject: displayValue(doc.getSubject()),
    keywords: displayValue(doc.getKeywords()),
    creator: displayValue(doc.getCreator()),
    producer: displayValue(doc.getProducer()),
    creationDate: formatPdfDate(doc.getCreationDate()),
    modificationDate: formatPdfDate(doc.getModificationDate()),
  };
}

export function metadataHasValues(meta: PdfMetadataInfo): boolean {
  return Object.values(meta).some((v) => v != null && String(v).trim().length > 0);
}

/** Returns true when the PDF requires a password to open. */
export async function isPdfEncrypted(file: File): Promise<boolean> {
  configurePdfJsWorker();
  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const task = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
    await task.promise;
    return false;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : String(err);
    if (name === 'PasswordException' || /password/i.test(message)) {
      return true;
    }
    throw err;
  }
}

export function scorePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  barClass: string;
  textClass: string;
} {
  let score = 0;
  if (password.length >= 6) score += 15;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 40) {
    return { score, label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-400' };
  }
  if (score < 65) {
    return { score, label: 'Fair', barClass: 'bg-amber-500', textClass: 'text-amber-400' };
  }
  if (score < 85) {
    return { score, label: 'Good', barClass: 'bg-emerald-500', textClass: 'text-emerald-400' };
  }
  return { score, label: 'Strong', barClass: 'bg-emerald-300', textClass: 'text-emerald-300' };
}
