import type { AppWorkspaceId } from '../../config/appWorkspaces';

const DB_NAME = 'gsm-omni-handoff';
const DB_VERSION = 1;
const STORE_NAME = 'handoffs';
const HANDOFF_KEY = 'active';
const HANDOFF_MAX_AGE_MS = 5 * 60 * 1000;

interface OmniHandoffRecord {
  intentId: string;
  workspaceId: AppWorkspaceId;
  fileName: string;
  fileType: string;
  fileSize: number;
  lastModified: number;
  savedAt: number;
  blob: Blob;
}

export interface OmniHandoffPayload {
  file: File;
  intentId: string;
  workspaceId: AppWorkspaceId;
}

function openHandoffDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open Omni handoff database.'));
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error('Failed to read Omni handoff.'));
  });
}

function idbPut(db: IDBDatabase, key: string, value: OmniHandoffRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save Omni handoff.'));
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to clear Omni handoff.'));
  });
}

/** Persist the dropped file locally before cross-route navigation (zero network I/O). */
export async function saveOmniHandoff(
  file: File,
  intentId: string,
  workspaceId: AppWorkspaceId,
): Promise<void> {
  const db = await openHandoffDb();
  try {
    const record: OmniHandoffRecord = {
      intentId,
      workspaceId,
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      lastModified: file.lastModified,
      savedAt: Date.now(),
      blob: file,
    };
    await idbPut(db, HANDOFF_KEY, record);
  } finally {
    db.close();
  }
}

/** Read and delete the pending handoff for the target workspace. */
export async function consumeOmniHandoff(
  expectedWorkspaceId: AppWorkspaceId,
): Promise<OmniHandoffPayload | null> {
  const db = await openHandoffDb();
  try {
    const record = await idbGet<OmniHandoffRecord>(db, HANDOFF_KEY);
    if (!record) return null;

    await idbDelete(db, HANDOFF_KEY);

    if (record.workspaceId !== expectedWorkspaceId) {
      return null;
    }

    if (Date.now() - record.savedAt > HANDOFF_MAX_AGE_MS) {
      return null;
    }

    const file = new File([record.blob], record.fileName, {
      type: record.fileType,
      lastModified: record.lastModified,
    });

    return {
      file,
      intentId: record.intentId,
      workspaceId: record.workspaceId,
    };
  } finally {
    db.close();
  }
}

export async function clearOmniHandoff(): Promise<void> {
  const db = await openHandoffDb();
  try {
    await idbDelete(db, HANDOFF_KEY);
  } finally {
    db.close();
  }
}

export function readOmniIntentFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('omni');
}

/** Remove `omni` query param after handoff completes. */
export function clearOmniUrlParam(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('omni')) return;
  url.searchParams.delete('omni');
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', next);
}
