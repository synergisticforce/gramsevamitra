import { configurePdfJsWorker, pdfjsLib } from './pdfJsWorker';

/** Returns true when the PDF requires a password to open. */
export async function isPdfEncrypted(file: File): Promise<boolean> {
  configurePdfJsWorker();
  const data = new Uint8Array(await file.arrayBuffer());

  try {
    const task = pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
    await task.promise;
    return false;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : String(err);
    if (name === 'PasswordException' || /password/i.test(message)) {
      return true;
    }
    throw err;
  }
}

export function formatUnlockError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/password|encrypt|decrypt|incorrect|unable to decrypt/i.test(message)) {
    return 'Incorrect password. Please verify and try again.';
  }
  return message || 'Unlock failed. Check the password and try again.';
}
