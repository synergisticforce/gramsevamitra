import { isMobileOrTablet } from '../pdf/deviceDetection';

/** RAM guardrails for FFmpeg.wasm — videos never leave the browser. */
export const MOBILE_VIDEO_MAX_BYTES = 250 * 1024 * 1024;
export const DESKTOP_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export const VIDEO_MEMORY_ERROR =
  'File exceeds safe browser memory for this device.';

export const VIDEO_PROCESSING_SUBTITLE =
  'Processing video locally… Please keep this tab open.';

export function getVideoProcessingLimitBytes(): number {
  return isMobileOrTablet() ? MOBILE_VIDEO_MAX_BYTES : DESKTOP_VIDEO_MAX_BYTES;
}

export function formatVideoLimitLabel(): string {
  const limit = getVideoProcessingLimitBytes();
  const mb = Math.round(limit / (1024 * 1024));
  return isMobileOrTablet() ? `${mb} MB on mobile/tablet` : `${mb} MB on desktop`;
}

export function isVideoWithinMemoryLimit(file: File): boolean {
  return file.size <= getVideoProcessingLimitBytes();
}

export function assertVideoWithinMemoryLimit(file: File): void {
  if (!isVideoWithinMemoryLimit(file)) {
    throw new Error(VIDEO_MEMORY_ERROR);
  }
}

const VIDEO_MIME_PREFIX = 'video/';
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/i;

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith(VIDEO_MIME_PREFIX)) return true;
  return VIDEO_EXTENSIONS.test(file.name);
}

export function splitVideoBaseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'video';
}
