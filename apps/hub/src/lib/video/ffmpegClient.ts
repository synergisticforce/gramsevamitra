import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { deliverFile } from '@shared/utils/fileDelivery';

const FFMPEG_CORE_VERSION = '0.12.6';
const FFMPEG_CDN = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

/** Size of the one-time video engine download, surfaced in the UI. */
export const FFMPEG_ENGINE_MB = 32;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type FfmpegProgressHandler = (ratio: number) => void;

/** True once the engine is in memory, so callers can skip the data warning. */
export function isFfmpegReady(): boolean {
  return Boolean(ffmpegInstance?.loaded);
}

export class FfmpegUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FfmpegUnavailableError';
  }
}

export async function getFfmpeg(onProgress?: FfmpegProgressHandler): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => onProgress(progress));
    }
    return ffmpegInstance;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new FfmpegUnavailableError(
      `Video tools need a one-time ${FFMPEG_ENGINE_MB} MB download and you are offline. Connect to Wi-Fi once, then video editing works without internet.`,
    );
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }) => {
        if (import.meta.env.DEV) console.debug('[ffmpeg]', message);
      });
      const coreURL = await toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })();

    // Without clearing the cached promise, one failed download poisoned every
    // later attempt for the whole session — even after the network came back.
    loadPromise.catch(() => {
      loadPromise = null;
      ffmpegInstance = null;
    });
  }

  let ffmpeg: FFmpeg;
  try {
    ffmpeg = await loadPromise;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new FfmpegUnavailableError(
      `Could not load the video engine (${FFMPEG_ENGINE_MB} MB one-time download). Check your connection and try again. ${detail}`,
    );
  }

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress));
  }
  return ffmpeg;
}

export async function resetFfmpegProgressHandler(): Promise<void> {
  if (!ffmpegInstance) return;
  ffmpegInstance.on('progress', () => {});
}

export async function writeInputFile(ffmpeg: FFmpeg, name: string, file: File): Promise<void> {
  await ffmpeg.writeFile(name, await fetchFile(file));
}

export async function readOutputFile(ffmpeg: FFmpeg, name: string): Promise<Uint8Array> {
  const data = await ffmpeg.readFile(name);
  if (data instanceof Uint8Array) return data;
  return new TextEncoder().encode(String(data));
}

export async function cleanupFiles(ffmpeg: FFmpeg, names: string[]): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      try {
        await ffmpeg.deleteFile(name);
      } catch {
        /* already removed */
      }
    }),
  );
}

export function downloadVideoOutput(data: Uint8Array, filename: string, mimeType: string): void {
  const copy = new Uint8Array(data);
  const blob = new Blob([copy as BlobPart], { type: mimeType });
  void deliverFile(blob, filename).catch((err) => {
    console.error('[ffmpegClient] Could not deliver video output:', err);
  });
}
