/** Detect Safari Private Mode / quota blocks without crashing auth flows. */
export function isStorageAccessError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return ['QuotaExceededError', 'SecurityError', 'InvalidStateError', 'UnknownError'].includes(
      err.name,
    );
  }
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    return (
      message.includes('indexeddb') ||
      message.includes('storage') ||
      message.includes('quota') ||
      message.includes('private browsing')
    );
  }
  return false;
}

export function safeSessionStorageSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('[storage] sessionStorage write skipped', { key, err });
    return false;
  }
}

export function safeSessionStorageGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (err) {
    console.warn('[storage] sessionStorage read skipped', { key, err });
    return null;
  }
}

export function safeSessionStorageRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (err) {
    console.warn('[storage] sessionStorage remove skipped', { key, err });
  }
}

export function safeLocalStorageClear(): void {
  try {
    localStorage.clear();
  } catch (err) {
    console.warn('[storage] localStorage clear skipped', err);
  }
}

export function safeSessionStorageClear(): void {
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn('[storage] sessionStorage clear skipped', err);
  }
}

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}
