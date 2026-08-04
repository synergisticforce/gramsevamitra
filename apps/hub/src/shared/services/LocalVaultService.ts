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

function openWebDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_META_STORE)) {
        db.createObjectStore(IDB_META_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB_BLOB_STORE)) {
        db.createObjectStore(IDB_BLOB_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open LocalVault database.'));
  });
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

class NativeVaultBackend implements VaultService {
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

    const index = await this.readIndex();
    index.unshift(meta);
    await this.writeIndex(index);
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

    const index = await this.readIndex();
    await this.writeIndex(index.filter((item) => item.id !== id));
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

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_META_STORE, IDB_BLOB_STORE], 'readwrite');
      tx.objectStore(IDB_META_STORE).put(meta);
      tx.objectStore(IDB_BLOB_STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to save vault file.'));
    });

    db.close();
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
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([IDB_META_STORE, IDB_BLOB_STORE], 'readwrite');
      tx.objectStore(IDB_META_STORE).delete(id);
      tx.objectStore(IDB_BLOB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete vault file.'));
    });
    db.close();
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
