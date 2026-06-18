export interface TesseractWorkerProgress {
  type: 'progress';
  status: string;
  progress?: number;
}

export interface TesseractWorkerDone {
  type: 'done';
  id: string;
  text: string;
  averageConfidence: number;
  words: Array<{ text: string; confidence: number }>;
  pagesSampled: number;
}

export interface TesseractWorkerError {
  type: 'error';
  id: string;
  message: string;
}

export type TesseractWorkerOutbound =
  | { type: 'recognize'; id: string; images: string[] }
  | { type: 'terminate' };

export type TesseractWorkerInbound =
  | TesseractWorkerProgress
  | TesseractWorkerDone
  | TesseractWorkerError;
