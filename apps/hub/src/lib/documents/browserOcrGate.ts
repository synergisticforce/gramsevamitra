import type { OcrWordBox } from '../ocr/tesseractWorkerTypes';

export const DOCUMENT_CONFIDENCE_MIN = 95;
const LOW_WORD_CONFIDENCE = 85;
const LOW_WORD_SHARE_MAX = 0.02;

export interface OcrGateInput {
  meanConfidence: number;
  words: Array<{ confidence?: number }>;
}

export function passesDocumentConfidenceGate(input: OcrGateInput): boolean {
  if (input.meanConfidence < DOCUMENT_CONFIDENCE_MIN) return false;
  if (input.words.length === 0) return false;
  const low = input.words.filter((word) => (word.confidence ?? 0) < LOW_WORD_CONFIDENCE).length;
  return low / input.words.length < LOW_WORD_SHARE_MAX;
}

/**
 * A table export needs the same 95% mean and word boxes that sit in rows
 * without two words occupying the same spot.
 */
export function passesTableAlignmentGate(words: OcrWordBox[]): boolean {
  if (!passesDocumentConfidenceGate({
    meanConfidence: meanOf(words),
    words,
  })) {
    return false;
  }
  if (words.length < 2) return false;

  const heights = words.map((word) => word.y1 - word.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 12;
  const rows: OcrWordBox[][] = [];

  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  for (const word of sorted) {
    const center = (word.y0 + word.y1) / 2;
    const row = rows.find((candidate) => {
      const rowCenter = candidate.reduce((sum, item) => sum + (item.y0 + item.y1) / 2, 0) / candidate.length;
      return Math.abs(center - rowCenter) <= medianHeight * 0.45;
    });
    if (row) row.push(word);
    else rows.push([word]);
  }

  let collisions = 0;
  let placed = 0;
  for (const row of rows) {
    const line = [...row].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < line.length; i += 1) {
      placed += 1;
      const previous = line[i - 1];
      const current = line[i];
      const overlap = Math.min(previous.x1, current.x1) - Math.max(previous.x0, current.x0);
      const width = Math.max(1, Math.min(previous.x1 - previous.x0, current.x1 - current.x0));
      if (overlap > width * 0.25) collisions += 1;
    }
  }

  return placed === 0 || collisions / Math.max(1, placed) < 0.05;
}

function meanOf(words: OcrWordBox[]): number {
  if (!words.length) return 0;
  return words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
}

export function wordsToGrid(words: OcrWordBox[]): string[][] {
  if (!words.length) return [];
  const heights = words.map((word) => word.y1 - word.y0).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 12;
  const sorted = [...words].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const rows: OcrWordBox[][] = [];
  for (const word of sorted) {
    const last = rows[rows.length - 1];
    if (!last || Math.abs(word.y0 - last[0].y0) > medianHeight * 0.45) rows.push([word]);
    else last.push(word);
  }

  const centers: number[] = [];
  for (const row of rows) {
    for (const word of row) {
      const x = (word.x0 + word.x1) / 2;
      if (!centers.some((center) => Math.abs(center - x) < 18)) centers.push(x);
    }
  }
  centers.sort((a, b) => a - b);
  if (centers.length === 0) return rows.map((row) => [row.map((word) => word.text).join(' ')]);

  return rows.map((row) => {
    const cells = centers.map(() => '');
    for (const word of [...row].sort((a, b) => a.x0 - b.x0)) {
      const x = (word.x0 + word.x1) / 2;
      let best = 0;
      let bestGap = Number.POSITIVE_INFINITY;
      centers.forEach((center, index) => {
        const gap = Math.abs(center - x);
        if (gap < bestGap) {
          bestGap = gap;
          best = index;
        }
      });
      cells[best] = cells[best] ? `${cells[best]} ${word.text}` : word.text;
    }
    return cells;
  });
}
