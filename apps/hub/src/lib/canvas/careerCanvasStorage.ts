/** SessionStorage persistence for Career Prep canvas state (Phase 6.1). */

export const CAREER_CANVAS_STORAGE_KEY = 'gsm-canvas-career';

export interface StoredFileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface StoredCareerCanvasState {
  version: 1;
  workspaceId: 'career';
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

export function loadCareerCanvasState(): StoredCareerCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CAREER_CANVAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCareerCanvasState;
    if (parsed.version !== 1 || parsed.workspaceId !== 'career' || !parsed.file?.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveCareerCanvasState(file: File): void {
  if (typeof window === 'undefined') return;
  const payload: StoredCareerCanvasState = {
    version: 1,
    workspaceId: 'career',
    file: fileToMeta(file),
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(CAREER_CANVAS_STORAGE_KEY, JSON.stringify(payload));
}

export function clearCareerCanvasState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(CAREER_CANVAS_STORAGE_KEY);
}

export { formatFileSize } from './documentCanvasStorage';
