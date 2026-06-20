/** IndexedDB snapshot for workspace state across OAuth redirects. */

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function readSnapshot(db: IDBDatabase): Promise<WorkspaceResumeSnapshot | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const request = store.get(SNAPSHOT_KEY);
    request.onsuccess = () => {
      const value = request.result as WorkspaceResumeSnapshot | undefined;
      if (!value || value.version !== 1 || !value.fileBlob) {
        resolve(null);
        return;
      }
      resolve(value);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
  });
}

function writeSnapshot(db: IDBDatabase, snapshot: WorkspaceResumeSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(snapshot, SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
  });
}

function deleteSnapshot(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(SNAPSHOT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
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

  const db = await openDb();
  try {
    await writeSnapshot(db, snapshot);
  } finally {
    db.close();
  }
}

export async function consumeProUpgradeResume(): Promise<WorkspaceResumeSnapshot | null> {
  if (typeof window === 'undefined') return null;

  const db = await openDb();
  try {
    const snapshot = await readSnapshot(db);
    if (!snapshot) return null;
    await deleteSnapshot(db);
    return snapshot;
  } finally {
    db.close();
  }
}

export async function clearWorkspaceResume(): Promise<void> {
  if (typeof window === 'undefined') return;
  const db = await openDb();
  try {
    await deleteSnapshot(db);
  } finally {
    db.close();
  }
}

export function snapshotToFile(snapshot: WorkspaceResumeSnapshot): File {
  return new File([snapshot.fileBlob], snapshot.fileName, {
    type: snapshot.fileType,
    lastModified: snapshot.fileLastModified,
  });
}
