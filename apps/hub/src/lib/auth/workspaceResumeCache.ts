/** IndexedDB snapshot for workspace state across OAuth redirects. */

import { isIndexedDbAvailable, isStorageAccessError } from '../storage/safeStorage';

const DB_NAME = 'gsm-workspace-resume';
const DB_VERSION = 1;
const STORE = 'snapshots';
const SNAPSHOT_KEY = 'active';

export type WorkspaceResumeIntent = 'PRO_UPGRADE';

export interface WorkspaceResumeSnapshot {
  version: 1;
  intent: WorkspaceResumeIntent;
  workspaceId: 'documents';
  returnPath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileLastModified: number;
  fileBlob: Blob;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!isIndexedDbAvailable()) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('[storage] IndexedDB open failed', request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn('[storage] IndexedDB open blocked');
        resolve(null);
      };
    } catch (err) {
      console.warn('[storage] IndexedDB unavailable', err);
      resolve(null);
    }
  });
}

function readSnapshot(db: IDBDatabase): Promise<WorkspaceResumeSnapshot | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(SNAPSHOT_KEY);
      request.onsuccess = () => {
        const value = request.result as WorkspaceResumeSnapshot | undefined;
        if (!value || value.version !== 1 || !value.fileBlob) {
          resolve(null);
          return;
        }
        resolve(value);
      };
      request.onerror = () => {
        console.warn('[storage] IndexedDB read failed', request.error);
        resolve(null);
      };
      tx.onerror = () => {
        console.warn('[storage] IndexedDB read transaction failed', tx.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[storage] IndexedDB read skipped', err);
      resolve(null);
    }
  });
}

function writeSnapshot(db: IDBDatabase, snapshot: WorkspaceResumeSnapshot): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(snapshot, SNAPSHOT_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.warn('[storage] IndexedDB write failed', tx.error);
        resolve(false);
      };
    } catch (err) {
      console.warn('[storage] IndexedDB write skipped', err);
      resolve(false);
    }
  });
}

function deleteSnapshot(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn('[storage] IndexedDB delete failed', tx.error);
        resolve();
      };
    } catch (err) {
      console.warn('[storage] IndexedDB delete skipped', err);
      resolve();
    }
  });
}

export async function saveProUpgradeResume(file: File, returnPath?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const snapshot: WorkspaceResumeSnapshot = {
    version: 1,
    intent: 'PRO_UPGRADE',
    workspaceId: 'documents',
    returnPath: returnPath ?? window.location.href,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    fileLastModified: file.lastModified,
    fileBlob: file,
    savedAt: new Date().toISOString(),
  };

  try {
    const db = await openDb();
    if (!db) return;
    try {
      await writeSnapshot(db, snapshot);
    } finally {
      db.close();
    }
  } catch (err) {
    if (isStorageAccessError(err)) {
      console.warn('[auth] Pro upgrade resume skipped — storage restricted', err);
      return;
    }
    console.warn('[auth] Pro upgrade resume skipped', err);
  }
}

export async function consumeProUpgradeResume(): Promise<WorkspaceResumeSnapshot | null> {
  if (typeof window === 'undefined') return null;

  try {
    const db = await openDb();
    if (!db) return null;
    try {
      const snapshot = await readSnapshot(db);
      if (!snapshot) return null;
      await deleteSnapshot(db);
      return snapshot;
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn('[auth] Pro upgrade resume read skipped', err);
    return null;
  }
}

export async function clearWorkspaceResume(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const db = await openDb();
    if (!db) return;
    try {
      await deleteSnapshot(db);
    } finally {
      db.close();
    }
  } catch (err) {
    console.warn('[auth] workspace resume clear skipped', err);
  }
}

export function snapshotToFile(snapshot: WorkspaceResumeSnapshot): File {
  return new File([snapshot.fileBlob], snapshot.fileName, {
    type: snapshot.fileType,
    lastModified: snapshot.fileLastModified,
  });
}
