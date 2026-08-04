/**
 * Platform-aware delivery of a finished file.
 *
 * A blob-URL anchor click is the only thing that works in a browser, but inside
 * an Android WebView it silently does nothing — no DownloadListener is attached,
 * so the user taps a tool, waits, and receives no file at all. On native we
 * therefore write the bytes to the public Documents folder and open the system
 * share sheet so the result is actually reachable.
 */

export type DeliveryMethod = 'browser-download' | 'native-file';

export interface DeliveryResult {
  method: DeliveryMethod;
  fileName: string;
  /** Native filesystem URI, when the file was written to disk. */
  uri?: string;
}

const NATIVE_OUTPUT_DIR = 'GramsevaMitra';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNativeRuntime(): boolean {
  try {
    const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read the finished file.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the finished file.'));
    reader.readAsDataURL(blob);
  });
}

function browserDownload(blob: Blob, fileName: string): DeliveryResult {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking immediately can cancel the download in Safari and Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { method: 'browser-download', fileName };
}

async function nativeSaveAndShare(blob: Blob, fileName: string): Promise<DeliveryResult> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const path = `${NATIVE_OUTPUT_DIR}/${fileName}`;
  const data = await blobToBase64(blob);

  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Documents,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({ path, directory: Directory.Documents });

  // Offering the share sheet is what makes the file usable — the user can send
  // it to WhatsApp, mail it, or move it with a file manager.
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: fileName, url: uri });
  } catch (err) {
    // Cancelling the share sheet is normal and must not look like a failure;
    // the file is already saved on disk either way.
    console.warn('[fileDelivery] Share sheet dismissed or unavailable:', err);
  }

  return { method: 'native-file', fileName, uri };
}

/**
 * Deliver a finished file to the user on whichever platform they are using.
 * Resolves once the file is downloaded (web) or written to disk (native).
 */
export async function deliverFile(blob: Blob, fileName: string): Promise<DeliveryResult> {
  if (isNativeRuntime()) {
    try {
      return await nativeSaveAndShare(blob, fileName);
    } catch (err) {
      console.error('[fileDelivery] Native save failed, falling back to download:', err);
      return browserDownload(blob, fileName);
    }
  }
  return browserDownload(blob, fileName);
}

/** Human-readable confirmation for a toast, matching where the file went. */
export function describeDelivery(result: DeliveryResult): string {
  if (result.method === 'native-file') {
    return `Saved to Documents/${NATIVE_OUTPUT_DIR} as ${result.fileName}`;
  }
  return `${result.fileName} downloaded`;
}
