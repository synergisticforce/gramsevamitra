import { createWorker } from 'tesseract.js';
import type {
  OcrPageWords,
  OcrWordBox,
  TesseractWorkerInbound,
  TesseractWorkerOutbound,
} from '../lib/ocr/tesseractWorkerTypes';

interface RawBbox {
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}

interface RawWord {
  text?: string;
  confidence?: number;
  bbox?: RawBbox;
}

/**
 * Tesseract exposes words either flat on `data.words` or nested inside
 * blocks → paragraphs → lines depending on the build and output flags, so
 * collect from whichever shape is present.
 */
function collectWords(data: unknown): RawWord[] {
  const page = data as {
    words?: RawWord[];
    blocks?: Array<{
      paragraphs?: Array<{ lines?: Array<{ words?: RawWord[] }> }>;
    }>;
  };

  if (page?.words?.length) return page.words;

  const out: RawWord[] = [];
  for (const block of page?.blocks ?? []) {
    for (const paragraph of block?.paragraphs ?? []) {
      for (const line of paragraph?.lines ?? []) {
        for (const word of line?.words ?? []) out.push(word);
      }
    }
  }
  return out;
}

function toWordBox(word: RawWord): OcrWordBox | null {
  const text = word.text?.trim();
  const bbox = word.bbox;
  if (!text || !bbox) return null;
  const { x0, y0, x1, y1 } = bbox;
  if (
    typeof x0 !== 'number' ||
    typeof y0 !== 'number' ||
    typeof x1 !== 'number' ||
    typeof y1 !== 'number' ||
    x1 <= x0 ||
    y1 <= y0
  ) {
    return null;
  }
  return { text, confidence: word.confidence ?? 0, x0, y0, x1, y1 };
}

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
    const pages: OcrPageWords[] = [];

    for (let i = 0; i < msg.images.length; i += 1) {
      const { data } = await worker.recognize(
        msg.images[i],
        {},
        msg.withBoxes ? { text: true, blocks: true } : undefined,
      );
      if (data.text?.trim()) textParts.push(data.text.trim());

      const rawWords = collectWords(data);
      const boxes: OcrWordBox[] = [];
      for (const raw of rawWords) {
        const trimmed = raw.text?.trim();
        if (!trimmed) continue;
        words.push({ text: trimmed, confidence: raw.confidence ?? 0 });
        if (msg.withBoxes) {
          const box = toWordBox(raw);
          if (box) boxes.push(box);
        }
      }

      if (msg.withBoxes) {
        const size = data as { imageWidth?: number; imageHeight?: number };
        pages.push({
          page: i,
          width: size.imageWidth ?? 0,
          height: size.imageHeight ?? 0,
          words: boxes,
        });
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
      ...(msg.withBoxes ? { pages } : {}),
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
