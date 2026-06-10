export type OcrWorkerRequest =
  | { type: 'init' }
  | { type: 'recognize'; id: string; images: string[] };

export type OcrWorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; status: string; progress?: number; file?: string }
  | { type: 'result'; id: string; text: string; lineCount: number }
  | { type: 'error'; id?: string; message: string };
