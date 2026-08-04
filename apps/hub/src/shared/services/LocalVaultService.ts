import { Capacitor } from '@capacitor/core';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  created: number;
  uri?: string;
}

export interface VaultService {
  saveFile(file: File | Blob, fileName: string, mimeType: string): Promise<string>;
  getFile(id: string): Promise<Blob | null>;
  deleteFile(id: string): Promise<void>;
  listFiles(): Promise<FileMetadata[]>;
  getFileUri(id: string): Promise<string | undefined>;
}

const VAULT_DIR = 'gramseva-vault';
const META_PREF_KEY = 'gramseva.vault.metadata';
const IDB_NAME = 'gramseva-local-vault';
const IDB_VERSION = 1;
const IDB_META_STORE = 'metadata';
const IDB_BLOB_STORE = 'blobs';

function createVaultId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `vault_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode vault file.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read vault file.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType || 'application/octet-stream' });
}

const OPEN_TIMEOUT_MS = 10_000;

/** Plain-language storage errors — rural users must never see a raw DOM exception. */
function describeStorageError(err: unknown, fallback: string): Error {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'QuotaExceededError') {
    return new Error(
      'This phone is out of free storage space. Delete a few saved files and try again.',
    );
  }
  if (name === 'VersionError') {
    return new Error('A newer version of the app already saved files here. Please reopen the app.');
  }
  if (name === 'InvalidStateError' || name === 'SecurityError') {
    return new Error(
      'Saving offline is blocked in private browsing. Open the app in a normal window to keep files.',
    );
  }
  if (err instanceof Error && err.message) return err;
  return new Error(fallback);
}

/** Ask the browser to keep vault data out of the evictable best-effort bucket. */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted?.()) return;
    await navigator.storage.persist();
  } catch {
    /* persistence is a best-effort hint; never block a save */
  }
}

function openWebDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Offline storage is not available in this browser.'));
      return;
    }

    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(IDB_NAME, IDB_VERSION);
    } catch (err) {
      reject(describeStorageError(err, 'Offline storage could not be opened.'));
      return;
    }

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    // Without this, a blocked upgrade leaves the promise pending forever and the
    // vault screen spins with no error and no retry.
    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new Error('Offline storage is busy in another tab. Close other tabs and try again.'),
        ),
      );
    }, OPEN_TIMEOUT_MS);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_META_STORE)) {
        db.createObjectStore(IDB_META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_BLOB_STORE)) {
        db.createObjectStore(IDB_BLOB_STORE);
      }
    };

    request.onblocked = () => {
      finish(() =>
        reject(
          new Error('Offline storage is open in another tab. Close other tabs and try again.'),
        ),
      );
    };

    request.onsuccess = () => finish(() => resolve(request.result));
    request.onerror = () =>
      finish(() =>
        reject(describeStorageError(request.error, 'Failed to open offline storage.')),
      );
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

class NativeVaultBackend implements VaultService {
  /**
   * The metadata index is a single Preferences blob, so concurrent
   * read-modify-write cycles would drop records. Chain every mutation.
   */
  private indexLock: Promise<unknown> = Promise.resolve();

  private withIndexLock<T>(task: () => Promise<T>): Promise<T> {
    const run = this.indexLock.then(task, task);
    this.indexLock = run.catch(() => undefined);
    return run;
  }

  private async ensureDirectory(): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    try {
      await Filesystem.mkdir({
        path: VAULT_DIR,
        directory: Directory.Data,
        recursive: true,
      });
    } catch {
      /* directory may already exist */
    }
  }

  private filePath(id: string): string {
    return `${VAULT_DIR}/${id}`;
  }

  private async readIndex(): Promise<FileMetadata[]> {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: META_PREF_KEY });
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as FileMetadata[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeIndex(items: FileMetadata[]): Promise<void> {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({
      key: META_PREF_KEY,
      value: JSON.stringify(items),
    });
  }

  async saveFile(file: File | Blob, fileName: string, mimeType: string): Promise<string> {
    await this.ensureDirectory();
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const id = createVaultId();
    const blob = file instanceof Blob ? file : new Blob([file], { type: mimeType });
    const base64 = await blobToBase64(blob);
    const path = this.filePath(id);

    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });

    const uriResult = await Filesystem.getUri({
      path,
      directory: Directory.Data,
    });

    const meta: FileMetadata = {
      id,
      name: fileName,
      size: blob.size,
      mimeType: mimeType || 'application/octet-stream',
      created: Date.now(),
      uri: uriResult.uri,
    };

    try {
      await this.withIndexLock(async () => {
        const index = await this.readIndex();
        index.unshift(meta);
        await this.writeIndex(index);
      });
    } catch (err) {
      // Never leave a file on disk that the index cannot see.
      try {
        await Filesystem.deleteFile({ path, directory: Directory.Data });
      } catch {
        /* best-effort cleanup */
      }
      throw describeStorageError(err, 'Could not save this document offline.');
    }
    return id;
  }

  async getFile(id: string): Promise<Blob | null> {
    const index = await this.readIndex();
    const meta = index.find((item) => item.id === id);
    if (!meta) return null;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const result = await Filesystem.readFile({
        path: this.filePath(id),
        directory: Directory.Data,
      });
      const data = typeof result.data === 'string' ? result.data : '';
      if (!data) return null;
      return base64ToBlob(data, meta.mimeType);
    } catch (err) {
      console.warn('[LocalVault] Native read failed:', err);
      return null;
    }
  }

  async deleteFile(id: string): Promise<void> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    try {
      await Filesystem.deleteFile({
        path: this.filePath(id),
        directory: Directory.Data,
      });
    } catch (err) {
      console.warn('[LocalVault] Native delete skipped missing file:', err);
    }

    await this.withIndexLock(async () => {
      const index = await this.readIndex();
      await this.writeIndex(index.filter((item) => item.id !== id));
    });
  }

  async listFiles(): Promise<FileMetadata[]> {
    const index = await this.readIndex();
    return [...index].sort((a, b) => b.created - a.created);
  }

  async getFileUri(id: string): Promise<string | undefined> {
    const index = await this.readIndex();
    const meta = index.find((item) => item.id === id);
    if (meta?.uri) return meta.uri;

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const uriResult = await Filesystem.getUri({
        path: this.filePath(id),
        directory: Directory.Data,
      });
      return uriResult.uri;
    } catch {
      return undefined;
    }
  }
}

class WebVaultBackend implements VaultService {
  async saveFile(file: File | Blob, fileName: string, mimeType: string): Promise<string> {
    await requestPersistentStorage();
    const db = await openWebDb();
    const id = createVaultId();
    const blob = file instanceof Blob ? file : new Blob([file], { type: mimeType });
    const meta: FileMetadata = {
      id,
      name: fileName,
      size: blob.size,
      mimeType: mimeType || 'application/octet-stream',
      created: Date.now(),
    };

    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([IDB_META_STORE, IDB_BLOB_STORE], 'readwrite');
        tx.objectStore(IDB_META_STORE).put(meta);
        tx.objectStore(IDB_BLOB_STORE).put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onabort = () =>
          reject(describeStorageError(tx.error, 'Could not save this document offline.'));
        tx.onerror = () =>
          reject(describeStorageError(tx.error, 'Could not save this document offline.'));
      });
    } finally {
      db.close();
    }

    return id;
  }

  async getFile(id: string): Promise<Blob | null> {
    const db = await openWebDb();
    try {
      const tx = db.transaction(IDB_BLOB_STORE, 'readonly');
      const blob = await idbRequest(tx.objectStore(IDB_BLOB_STORE).get(id));
      return blob instanceof Blob ? blob : null;
    } finally {
      db.close();
    }
  }

  async deleteFile(id: string): Promise<void> {
    const db = await openWebDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([IDB_META_STORE, IDB_BLOB_STORE], 'readwrite');
        tx.objectStore(IDB_META_STORE).delete(id);
        tx.objectStore(IDB_BLOB_STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(describeStorageError(tx.error, 'Failed to delete this file.'));
        tx.onerror = () => reject(describeStorageError(tx.error, 'Failed to delete this file.'));
      });
    } finally {
      db.close();
    }
  }

  async listFiles(): Promise<FileMetadata[]> {
    const db = await openWebDb();
    try {
      const tx = db.transaction(IDB_META_STORE, 'readonly');
      const items = await idbRequest(tx.objectStore(IDB_META_STORE).getAll());
      const list = Array.isArray(items) ? (items as FileMetadata[]) : [];
      return list.sort((a, b) => b.created - a.created);
    } finally {
      db.close();
    }
  }

  async getFileUri(_id: string): Promise<string | undefined> {
    return undefined;
  }
}

/**
 * Unified local-first vault — native Filesystem on Capacitor, IndexedDB on web PWA.
 */
export class LocalVaultService implements VaultService {
  private readonly backend: VaultService;

  constructor() {
    this.backend = Capacitor.isNativePlatform()
      ? new NativeVaultBackend()
      : new WebVaultBackend();
  }

  saveFile(file: File | Blob, fileName: string, mimeType: string): Promise<string> {
    return this.backend.saveFile(file, fileName, mimeType);
  }

  getFile(id: string): Promise<Blob | null> {
    return this.backend.getFile(id);
  }

  deleteFile(id: string): Promise<void> {
    return this.backend.deleteFile(id);
  }

  listFiles(): Promise<FileMetadata[]> {
    return this.backend.listFiles();
  }

  getFileUri(id: string): Promise<string | undefined> {
    return this.backend.getFileUri(id);
  }
}

export const localVaultService = new LocalVaultService();
