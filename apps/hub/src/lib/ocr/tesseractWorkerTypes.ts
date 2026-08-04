export interface TesseractWorkerProgress {
  type: 'progress';
  status: string;
  progress?: number;
}

export interface OcrWordBox {
  text: string;
  confidence: number;
  /** Pixel coordinates in the recognised image, origin top-left. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrPageWords {
  /** Index into the submitted images array. */
  page: number;
  width: number;
  height: number;
  words: OcrWordBox[];
}

export interface TesseractWorkerDone {
  type: 'done';
  id: string;
  text: string;
  averageConfidence: number;
  words: Array<{ text: string; confidence: number }>;
  pagesSampled: number;
  /** Per-page word boxes, present when `withBoxes` was requested. */
  pages?: OcrPageWords[];
}

export interface TesseractWorkerError {
  type: 'error';
  id: string;
  message: string;
}

export type TesseractWorkerOutbound =
  | { type: 'recognize'; id: string; images: string[]; withBoxes?: boolean }
  | { type: 'terminate' };

export type TesseractWorkerInbound =
  | TesseractWorkerProgress
  | TesseractWorkerDone
  | TesseractWorkerError;
