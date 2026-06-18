import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const FFMPEG_CORE_VERSION = '0.12.6';
const FFMPEG_CDN = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export type FfmpegProgressHandler = (ratio: number) => void;

export async function getFfmpeg(onProgress?: FfmpegProgressHandler): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    if (onProgress) {
      ffmpegInstance.on('progress', ({ progress }) => onProgress(progress));
    }
    return ffmpegInstance;
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
  }

  const ffmpeg = await loadPromise;
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
  const blob = new Blob([copy], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
