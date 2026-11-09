import { deliverFile } from '@shared/utils/fileDelivery';
import { textToDocxBlob } from '../canvas/extractToWord';
import { splitFilenameBase } from '../canvas/documentPdfTools';

export type EditableExportFormat = 'xlsx' | 'csv' | 'docx' | 'txt' | 'md';

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function gridToCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => escapeCsv(cell ?? '')).join(',')).join('\n');
}

export function gridToMarkdown(rows: string[][]): string {
  if (!rows.length) return '';
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
  const header = padded[0];
  const divider = header.map(() => '---');
  const body = padded.slice(1);
  return [header, divider, ...body].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

export function gridToPlainText(rows: string[][]): string {
  return rows.map((row) => row.filter(Boolean).join(' | ')).join('\n');
}

export async function downloadEditableGrid(
  rows: string[][],
  format: EditableExportFormat,
  sourceName: string,
): Promise<string> {
  const base = splitFilenameBase(sourceName).replace(/[^\w.-]+/g, '_') || 'document';
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Document');
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as number[];
    const fileName = `${base}.xlsx`;
    await deliverFile(
      new Blob([new Uint8Array(bytes)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      fileName,
    );
    return fileName;
  }

  if (format === 'csv') {
    const fileName = `${base}.csv`;
    await deliverFile(new Blob([gridToCsv(rows)], { type: 'text/csv;charset=utf-8' }), fileName);
    return fileName;
  }

  const text = format === 'md' ? gridToMarkdown(rows) : gridToPlainText(rows);
  if (format === 'docx') {
    const blob = await textToDocxBlob(text, base);
    const fileName = `${base}.docx`;
    await deliverFile(blob, fileName);
    return fileName;
  }

  const fileName = `${base}.${format === 'md' ? 'md' : 'txt'}`;
  const type = format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
  await deliverFile(new Blob([text], { type }), fileName);
  return fileName;
}
