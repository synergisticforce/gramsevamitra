import type { VideoToolId } from '../../config/videoCanvasTools';
import { isVideoToolId } from '../../config/videoCanvasTools';

export const VIDEO_STORAGE_KEYS = {
  activeTool: 'gsm-video-active-tool',
  compressPreset: 'gsm-video-compress-preset',
  outputFormat: 'gsm-video-output-format',
  gifOptions: 'gsm-video-gif-options',
  trimOptions: 'gsm-video-trim-options',
  watermarkText: 'gsm-video-watermark-text',
  speedPreset: 'gsm-video-speed-preset',
  frameSecond: 'gsm-video-frame-second',
} as const;

export function loadVideoActiveTool(): VideoToolId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(VIDEO_STORAGE_KEYS.activeTool);
    if (raw && isVideoToolId(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveVideoActiveTool(toolId: VideoToolId | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (toolId) localStorage.setItem(VIDEO_STORAGE_KEYS.activeTool, toolId);
    else localStorage.removeItem(VIDEO_STORAGE_KEYS.activeTool);
  } catch {
    /* ignore */
  }
}

export function loadPersistedJson<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function savePersistedJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
