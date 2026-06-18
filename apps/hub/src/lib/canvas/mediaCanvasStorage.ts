/** SessionStorage persistence for Media Lab canvas state (Phase 4.5). */

export const MEDIA_CANVAS_STORAGE_KEY = 'gsm-canvas-media';

export interface StoredFileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface StoredMediaCanvasState {
  version: 1;
  workspaceId: 'image' | 'media';
  file: StoredFileMeta;
  savedAt: string;
}

export function fileToMeta(file: File): StoredFileMeta {
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    lastModified: file.lastModified,
  };
}

export function loadMediaCanvasState(): StoredMediaCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(MEDIA_CANVAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMediaCanvasState;
    if (parsed.version !== 1 || !parsed.file?.name) {
      return null;
    }
    if (parsed.workspaceId !== 'image' && parsed.workspaceId !== 'media') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveMediaCanvasState(file: File): void {
  if (typeof window === 'undefined') return;
  const payload: StoredMediaCanvasState = {
    version: 1,
    workspaceId: 'image',
    file: fileToMeta(file),
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(MEDIA_CANVAS_STORAGE_KEY, JSON.stringify(payload));
}

export function clearMediaCanvasState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(MEDIA_CANVAS_STORAGE_KEY);
}

export { formatFileSize } from './documentCanvasStorage';
