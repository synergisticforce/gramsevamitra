import { createWorker } from 'tesseract.js';
import type { TesseractWorkerInbound, TesseractWorkerOutbound } from '../lib/ocr/tesseractWorkerTypes';

type WorkerInstance = Awaited<ReturnType<typeof createWorker>>;

let workerLoad: Promise<WorkerInstance> | null = null;

function getWorker(): Promise<WorkerInstance> {
  if (!workerLoad) {
    workerLoad = createWorker(['eng', 'hin'], 1, {
      logger: (message) => {
        if (message.status) {
          const payload: TesseractWorkerInbound = {
            type: 'progress',
            status: message.status,
            progress: message.progress,
          };
          self.postMessage(payload);
        }
      },
    });
  }
  return workerLoad;
}

self.onmessage = async (event: MessageEvent<TesseractWorkerOutbound>) => {
  const msg = event.data;

  if (msg.type === 'terminate') {
    if (workerLoad) {
      const worker = await workerLoad;
      await worker.terminate();
      workerLoad = null;
    }
    return;
  }

  if (msg.type !== 'recognize') return;

  try {
    const worker = await getWorker();
    const textParts: string[] = [];
    const words: Array<{ text: string; confidence: number }> = [];

    for (let i = 0; i < msg.images.length; i += 1) {
      const { data } = await worker.recognize(msg.images[i]);
      if (data.text?.trim()) textParts.push(data.text.trim());
      for (const word of data.words ?? []) {
        if (word.text?.trim()) {
          words.push({ text: word.text, confidence: word.confidence ?? 0 });
        }
      }
    }

    const text = textParts.join('\n\n');
    const confidences = words.map((w) => w.confidence).filter((c) => c >= 0);
    const averageConfidence =
      confidences.length > 0
        ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
        : 0;

    const done: TesseractWorkerInbound = {
      type: 'done',
      id: msg.id,
      text,
      averageConfidence,
      words,
      pagesSampled: msg.images.length,
    };
    self.postMessage(done);
  } catch (err) {
    const error: TesseractWorkerInbound = {
      type: 'error',
      id: msg.id,
      message: err instanceof Error ? err.message : 'Tesseract OCR failed.',
    };
    self.postMessage(error);
  }
};
