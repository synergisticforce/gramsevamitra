import { Capacitor } from '@capacitor/core';
import { deliverFile } from '@shared/utils/fileDelivery';
import { htmlToDocxBlob } from '../../lib/canvas/htmlToDocx';
import { apiUrl } from '../lib/apiBase';
import { localVaultService } from './LocalVaultService';

export type TargetFormat = 'docx' | 'xlsx' | 'csv';

export interface ConversionJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
  format?: TargetFormat;
  fileName?: string;
  html?: string;
  rows?: string[][];
  remainingCredits?: number;
}

export interface SavedConversion {
  vaultId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
}

const MIME_BY_FORMAT: Record<TargetFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(',')).join('\n');
}

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Minimal single-sheet XLSX (OOXML) without SheetJS — rural-network friendly. */
function rowsToXlsxBlob(rows: string[][]): Blob {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const col = encodeExcelColumn(colIndex + 1);
          const ref = `${col}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(cell ?? ''))}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `</Types>`;

  const files: Record<string, string> = {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbookXml,
    'xl/_rels/workbook.xml.rels': workbookRels,
    'xl/worksheets/sheet1.xml': sheetXml,
  };

  const zipBytes = buildZipStore(files);
  const copy = new Uint8Array(zipBytes.byteLength);
  copy.set(zipBytes);
  return new Blob([copy], { type: MIME_BY_FORMAT.xlsx });
}

function encodeExcelColumn(index: number): string {
  let n = index;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZipStore(files: Record<string, string>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const dataBytes = encoder.encode(content);
    const checksum = crc32(dataBytes);

    const local = new Uint8Array(30 + nameBytes.length + dataBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(8, 0, true); // store
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, dataBytes.length, true);
    localView.setUint32(22, dataBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(dataBytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, dataBytes.length, true);
    centralView.setUint32(24, dataBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centralParts.length, true);
  endView.setUint16(10, centralParts.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const total =
    localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of localParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  out.set(end, cursor);
  return out;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  void deliverFile(blob, fileName).catch((err) => {
    console.error('[AiConverterService] Could not deliver converted file:', err);
  });
}

/**
 * Dual-platform AI document converter — Gemini via Cloudflare, vault + PWA download.
 */
export class AiConverterService {
  private readonly jobCache = new Map<string, ConversionJob>();

  async startConversion(fileBlob: Blob, format: TargetFormat): Promise<string> {
    if (!fileBlob || fileBlob.size <= 0) {
      throw new Error('Choose a PDF or image to convert.');
    }
    if (format !== 'docx' && format !== 'xlsx' && format !== 'csv') {
      throw new Error('Unsupported target format.');
    }

    const fileName =
      fileBlob instanceof File && fileBlob.name
        ? fileBlob.name
        : `document.${fileBlob.type.includes('pdf') ? 'pdf' : 'jpg'}`;

    const form = new FormData();
    form.append('file', fileBlob, fileName);
    form.append('format', format);

    const response = await fetch(apiUrl('/api/ai/convert-document'), {
      method: 'POST',
      credentials: 'include',
      body: form,
    });

    const result = (await response.json()) as ConversionJob & {
      success?: boolean;
      message?: string;
      error?: string;
      code?: string;
    };

    if (!response.ok || !result.jobId) {
      throw new Error(result.message || result.error || 'Unable to start AI conversion.');
    }

    const job: ConversionJob = {
      jobId: result.jobId,
      status: (result.status as ConversionJob['status']) || 'pending',
      downloadUrl: result.downloadUrl,
      error: result.error,
      format: result.format ?? format,
      fileName: result.fileName,
      html: result.html,
      rows: result.rows,
      remainingCredits: result.remainingCredits,
    };
    this.jobCache.set(job.jobId, job);
    return job.jobId;
  }

  async checkStatus(jobId: string): Promise<ConversionJob> {
    const cached = this.jobCache.get(jobId);
    if (cached && (cached.status === 'completed' || cached.status === 'failed')) {
      return cached;
    }

    const response = await fetch(
      apiUrl(`/api/ai/conversion-status?jobId=${encodeURIComponent(jobId)}`),
      { credentials: 'include' },
    );

    // Sync-fallback jobs may 404 on status — keep cached completed payload.
    if (response.status === 404 && cached) {
      return cached;
    }

    const result = (await response.json()) as ConversionJob & {
      message?: string;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(result.message || result.error || 'Unable to check conversion status.');
    }

    const job: ConversionJob = {
      jobId: result.jobId || jobId,
      status: result.status,
      downloadUrl: result.downloadUrl,
      error: result.error,
      format: result.format ?? cached?.format,
      fileName: result.fileName ?? cached?.fileName,
      html: result.html ?? cached?.html,
      rows: result.rows ?? cached?.rows,
      remainingCredits: result.remainingCredits,
    };
    this.jobCache.set(job.jobId, job);
    return job;
  }

  async pollUntilComplete(
    jobId: string,
    options?: { maxMs?: number; intervalMs?: number; onTick?: (job: ConversionJob) => void },
  ): Promise<ConversionJob> {
    const maxMs = options?.maxMs ?? 120_000;
    const intervalMs = options?.intervalMs ?? 1500;
    const started = Date.now();

    while (Date.now() - started < maxMs) {
      const job = await this.checkStatus(jobId);
      options?.onTick?.(job);
      if (job.status === 'completed' || job.status === 'failed') {
        return job;
      }
      await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    }

    throw new Error('AI conversion timed out. Please try again.');
  }

  async materializeBlob(job: ConversionJob): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    if (job.status !== 'completed') {
      throw new Error(job.error || 'Conversion is not complete yet.');
    }

    const format = job.format ?? 'docx';
    const fileName = job.fileName || `converted.${format}`;
    const mimeType = MIME_BY_FORMAT[format];

    if (format === 'docx') {
      if (!job.html) throw new Error('Missing layout HTML for Word export.');
      const blob = await htmlToDocxBlob(job.html, fileName.replace(/\.docx$/i, ''));
      return { blob, fileName, mimeType };
    }

    if (!job.rows?.length) {
      throw new Error('Missing table data for spreadsheet export.');
    }

    if (format === 'csv') {
      const blob = new Blob([rowsToCsv(job.rows)], { type: mimeType });
      return { blob, fileName, mimeType };
    }

    return { blob: rowsToXlsxBlob(job.rows), fileName, mimeType };
  }

  /**
   * Native → LocalVault filesystem only.
   * Web/PWA → LocalVault (IndexedDB) + browser download prompt.
   */
  async saveConvertedFile(
    fileBlob: Blob,
    fileName: string,
    mimeType: string,
    options?: { forceDownload?: boolean },
  ): Promise<SavedConversion> {
    const vaultId = await localVaultService.saveFile(fileBlob, fileName, mimeType);

    const shouldDownload =
      Boolean(options?.forceDownload) || !Capacitor.isNativePlatform();
    if (shouldDownload) {
      triggerBrowserDownload(fileBlob, fileName);
    }

    return { vaultId, fileName, mimeType, blob: fileBlob };
  }
}

export const aiConverterService = new AiConverterService();
