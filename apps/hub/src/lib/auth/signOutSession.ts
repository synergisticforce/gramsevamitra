import { authClient } from '@gramsevamitra/auth/client';
import { clearWorkspaceResume } from './workspaceResumeCache';

const APP_INDEXED_DB_NAMES = ['gsm-workspace-resume', 'gsm-omni-handoff'] as const;

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Remove all client-side user state — intended for shared-device sign-out. */
export async function wipeClientUserState(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.clear();
  } catch {
    /* ignore quota / privacy errors */
  }

  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    await clearWorkspaceResume();
  } catch {
    /* ignore */
  }

  await Promise.all(APP_INDEXED_DB_NAMES.map((name) => deleteIndexedDb(name)));
}

/**
 * Sign out, wipe local stores, and hard-redirect so the Back button cannot
 * restore a cached protected view.
 */
export async function performSignOut(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    /* still wipe local state even when the API call fails */
  }

  await wipeClientUserState();
  window.location.replace('/?signIn=1');
}
