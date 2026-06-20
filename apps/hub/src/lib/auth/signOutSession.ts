import { authClient } from '@gramsevamitra/auth/client';
import { safeLocalStorageClear, safeSessionStorageClear } from '../storage/safeStorage';
import { markSigningOut } from './signOutState';
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

  safeSessionStorageClear();
  safeLocalStorageClear();

  try {
    await clearWorkspaceResume();
  } catch (err) {
    console.warn('[auth] workspace resume clear skipped', err);
  }

  await Promise.all(APP_INDEXED_DB_NAMES.map((name) => deleteIndexedDb(name)));
}

function waitForPendingWork(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/**
 * Sign out, wipe local stores, and hard-redirect so the Back button cannot
 * restore a cached protected view.
 */
export async function performSignOut(): Promise<void> {
  markSigningOut();

  try {
    await authClient.signOut();
  } catch (err) {
    console.warn('[auth] signOut API failed — continuing local wipe', err);
  }

  await wipeClientUserState();
  await waitForPendingWork();
  window.location.replace('/?signIn=1');
}
