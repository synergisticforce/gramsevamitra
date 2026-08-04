/// <reference lib="webworker" />

/**
 * On-device background removal using the RMBG-1.4 segmentation model through
 * transformers.js. Runs in a worker because inference blocks for several
 * seconds on low-end phones and must not freeze the UI.
 *
 * The model weights are fetched once from the Hugging Face CDN and then served
 * from the browser cache, so repeat use works offline.
 */

export interface BgRemovalRequest {
  type: 'remove';
  id: string;
  width: number;
  height: number;
  /** RGBA pixels of the source image. */
  pixels: ArrayBuffer;
}

export interface BgRemovalProgress {
  type: 'progress';
  label: string;
  percent: number;
}

export interface BgRemovalDone {
  type: 'done';
  id: string;
  /** Single-channel alpha mask at source resolution. */
  mask: ArrayBuffer;
  width: number;
  height: number;
}

export interface BgRemovalError {
  type: 'error';
  id: string;
  message: string;
}

export type BgRemovalOutbound = BgRemovalRequest | { type: 'dispose' };
export type BgRemovalInbound = BgRemovalProgress | BgRemovalDone | BgRemovalError;

const MODEL_ID = 'briaai/RMBG-1.4';

type ModelBundle = {
  model: Awaited<ReturnType<typeof loadModel>>['model'];
  processor: Awaited<ReturnType<typeof loadModel>>['processor'];
};

let bundle: Promise<ModelBundle> | null = null;

function post(message: BgRemovalInbound): void {
  self.postMessage(message);
}

async function loadModel() {
  const { AutoModel, AutoProcessor, env } = await import('@huggingface/transformers');

  // Always fetch from the CDN; there are no bundled weights in this app.
  env.allowLocalModels = false;

  const model = await AutoModel.from_pretrained(MODEL_ID, {
    // RMBG ships a custom architecture that needs an explicit model type.
    config: { model_type: 'custom' } as never,
    progress_callback: (progress: unknown) => {
      const info = progress as { status?: string; progress?: number };
      if (info?.status === 'progress' && typeof info.progress === 'number') {
        post({
          type: 'progress',
          label: 'Downloading the cut-out model (one time)…',
          percent: Math.min(60, Math.round(info.progress * 0.6)),
        });
      }
    },
  });

  const processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    config: {
      do_normalize: true,
      do_pad: false,
      do_rescale: true,
      do_resize: true,
      image_mean: [0.5, 0.5, 0.5],
      image_std: [1, 1, 1],
      feature_extractor_type: 'ImageFeatureExtractor',
      resample: 2,
      rescale_factor: 1 / 255,
      size: { width: 1024, height: 1024 },
    } as never,
  });

  return { model, processor };
}

function getBundle(): Promise<ModelBundle> {
  if (!bundle) {
    bundle = loadModel().catch((err) => {
      // Clear the cache so a retry can succeed after a network failure.
      bundle = null;
      throw err;
    });
  }
  return bundle;
}

self.onmessage = async (event: MessageEvent<BgRemovalOutbound>) => {
  const message = event.data;

  if (message.type === 'dispose') {
    bundle = null;
    return;
  }

  if (message.type !== 'remove') return;

  try {
    post({ type: 'progress', label: 'Preparing the cut-out model…', percent: 5 });
    const { model, processor } = await getBundle();

    const { RawImage } = await import('@huggingface/transformers');
    const image = new RawImage(
      new Uint8ClampedArray(message.pixels),
      message.width,
      message.height,
      4,
    );

    post({ type: 'progress', label: 'Finding the subject…', percent: 70 });
    const { pixel_values: pixelValues } = await processor(image);

    post({ type: 'progress', label: 'Separating the background…', percent: 82 });
    const output = await model({ input: pixelValues });

    const tensor = (output as { output?: unknown }).output ?? output;
    const first = (tensor as { [index: number]: unknown })[0];
    const maskImage = await RawImage.fromTensor(
      (first as { mul: (n: number) => { to: (t: string) => unknown } }).mul(255).to('uint8') as never,
    ).resize(message.width, message.height);

    post({ type: 'progress', label: 'Finishing the cut-out…', percent: 94 });

    // The mask may come back with more than one channel; keep the first.
    const channels = maskImage.channels ?? 1;
    const raw = maskImage.data as Uint8Array | Uint8ClampedArray;
    const alpha = new Uint8Array(message.width * message.height);
    for (let i = 0; i < alpha.length; i += 1) {
      alpha[i] = raw[i * channels];
    }

    const done: BgRemovalDone = {
      type: 'done',
      id: message.id,
      mask: alpha.buffer,
      width: message.width,
      height: message.height,
    };
    self.postMessage(done, [alpha.buffer]);
  } catch (err) {
    post({
      type: 'error',
      id: message.id,
      message:
        err instanceof Error
          ? err.message
          : 'Could not remove the background. Please try again.',
    });
  }
};
