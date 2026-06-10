import { env, pipeline } from '@huggingface/transformers';
import type { OcrWorkerRequest, OcrWorkerResponse } from '../lib/ocr/ocrWorkerTypes';

/** ONNX Runtime Web via Transformers.js — TrOCR printed text (no Tesseract). */
const MODEL_ID = 'Xenova/trocr-base-printed';

type OcrProgress = { status: string; progress?: number; file?: string };

class OcrPipelineSingleton {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static instance: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static loading: Promise<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getInstance(onProgress?: (p: OcrProgress) => void): Promise<any> {
    if (this.instance) return Promise.resolve(this.instance);
    if (!this.loading) {
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      this.loading = pipeline('image-to-text', MODEL_ID, {
        progress_callback: (data: OcrProgress) => {
          onProgress?.(data);
        },
      }).then((pipe) => {
        this.instance = pipe;
        return pipe;
      });
    }
    return this.loading;
  }
}

self.addEventListener('message', async (event: MessageEvent<OcrWorkerRequest>) => {
  const msg = event.data;

  try {
    if (msg.type === 'init') {
      await OcrPipelineSingleton.getInstance((p) => {
        self.postMessage({
          type: 'progress',
          status: p.status,
          progress: p.progress,
          file: p.file,
        } satisfies OcrWorkerResponse);
      });
      self.postMessage({ type: 'ready' } satisfies OcrWorkerResponse);
      return;
    }

    if (msg.type === 'recognize') {
      const pipe = await OcrPipelineSingleton.getInstance((p) => {
        self.postMessage({
          type: 'progress',
          status: p.status,
          progress: p.progress,
          file: p.file,
        } satisfies OcrWorkerResponse);
      });

      const lines: string[] = [];
      for (const dataUrl of msg.images) {
        const output = await pipe(dataUrl);
        const text = Array.isArray(output)
          ? (output[0]?.generated_text ?? '').trim()
          : String((output as { generated_text?: string })?.generated_text ?? '').trim();
        if (text) lines.push(text);
      }

      self.postMessage({
        type: 'result',
        id: msg.id,
        text: lines.join('\n'),
        lineCount: lines.length,
      } satisfies OcrWorkerResponse);
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id: msg.type === 'recognize' ? msg.id : undefined,
      message: err instanceof Error ? err.message : 'OCR failed',
    } satisfies OcrWorkerResponse);
  }
});
