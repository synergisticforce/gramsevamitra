import { loadPdfDocument } from '../pdf/pdfRender';
import { hasCorruptedLegacyIndicFont } from './legacyIndicFont';

export interface DigitalPdfGrid {
  rows: string[][];
  text: string;
  pageCount: number;
  pagesRead: number;
}

const MAX_PAGES = 12;

interface Glyph {
  text: string;
  x: number;
  y: number;
  height: number;
}

function asGlyph(item: unknown): Glyph | null {
  if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) return null;
  const text = String((item as { str: unknown }).str ?? '').trim();
  const transform = (item as { transform: unknown }).transform;
  if (!text || !Array.isArray(transform) || transform.length < 6) return null;
  const numbers = transform.map((value) => Number(value));
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  const height = Math.max(1, Math.hypot(numbers[1], numbers[3]));
  return {
    text,
    x: numbers[4],
    y: -numbers[5],
    height,
  };
}

function clusterColumns(glyphs: Glyph[]): number[] {
  const xs = glyphs.map((glyph) => glyph.x).sort((a, b) => a - b);
  const centers: number[] = [];
  for (const x of xs) {
    const last = centers[centers.length - 1];
    if (last === undefined || x - last > 14) centers.push(x);
    else centers[centers.length - 1] = (last + x) / 2;
  }
  return centers;
}

function gridFromGlyphs(glyphs: Glyph[]): string[][] {
  if (!glyphs.length) return [];
  const sorted = [...glyphs].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Glyph[][] = [];
  for (const glyph of sorted) {
    const last = rows[rows.length - 1];
    const tolerance = Math.max(glyph.height, last?.[0]?.height ?? glyph.height) * 0.3;
    if (!last || Math.abs(glyph.y - last[0].y) > tolerance) rows.push([glyph]);
    else last.push(glyph);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);

  const centers = clusterColumns(glyphs);
  if (centers.length < 2) {
    return rows.map((row) => [row.map((glyph) => glyph.text).join(' ')]);
  }

  return rows.map((row) => {
    const cells = centers.map(() => '');
    for (const glyph of row) {
      let best = 0;
      let gap = Number.POSITIVE_INFINITY;
      centers.forEach((center, index) => {
        const next = Math.abs(center - glyph.x);
        if (next < gap) {
          gap = next;
          best = index;
        }
      });
      cells[best] = cells[best] ? `${cells[best]} ${glyph.text}` : glyph.text;
    }
    return cells;
  });
}

export async function readDigitalPdfGrid(file: File): Promise<DigitalPdfGrid | 'CORRUPTED_DIGITAL' | null> {
  const pdf = await loadPdfDocument(file);
  const pagesRead = Math.min(pdf.numPages, MAX_PAGES);
  const glyphs: Glyph[] = [];
  const textParts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageGlyphs: Glyph[] = [];
    for (const item of content.items) {
      const glyph = asGlyph(item);
      if (glyph) pageGlyphs.push(glyph);
    }
    glyphs.push(...pageGlyphs);
    textParts.push(pageGlyphs.map((glyph) => glyph.text).join(' '));
    page.cleanup();
  }

  const text = textParts.join('\n').replace(/\s+/g, ' ').trim();
  if (text.length < 40) return null;
  if (hasCorruptedLegacyIndicFont(text)) return 'CORRUPTED_DIGITAL';

  const rows = gridFromGlyphs(glyphs).filter((row) => row.some((cell) => cell.trim()));
  if (!rows.length) return null;
  return { rows, text, pageCount: pdf.numPages, pagesRead };
}
