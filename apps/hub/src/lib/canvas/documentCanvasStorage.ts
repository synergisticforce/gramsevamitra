/** SessionStorage persistence for Document Studio canvas state (Phase 2). */

export const DOCUMENT_CANVAS_STORAGE_KEY = 'gsm-canvas-documents';

export interface StoredFileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface StoredDocumentCanvasState {
  version: 1;
  workspaceId: 'documents';
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

export function loadDocumentCanvasState(): StoredDocumentCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DOCUMENT_CANVAS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDocumentCanvasState;
    if (parsed.version !== 1 || parsed.workspaceId !== 'documents' || !parsed.file?.name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDocumentCanvasState(file: File): void {
  if (typeof window === 'undefined') return;
  const payload: StoredDocumentCanvasState = {
    version: 1,
    workspaceId: 'documents',
    file: fileToMeta(file),
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(DOCUMENT_CANVAS_STORAGE_KEY, JSON.stringify(payload));
}

export function saveDocumentCanvasMeta(file: StoredFileMeta): void {
  if (typeof window === 'undefined') return;
  const payload: StoredDocumentCanvasState = {
    version: 1,
    workspaceId: 'documents',
    file,
    savedAt: new Date().toISOString(),
  };
  sessionStorage.setItem(DOCUMENT_CANVAS_STORAGE_KEY, JSON.stringify(payload));
}

export function clearDocumentCanvasState(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DOCUMENT_CANVAS_STORAGE_KEY);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
