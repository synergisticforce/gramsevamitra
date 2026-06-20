import { isStorageAccessError } from '../storage/safeStorage';
import { getActiveWorkspaceFile } from './workspaceFileRegistry';
import { saveProUpgradeResume } from './workspaceResumeCache';

/** Persist canvas file + intent before Better Auth redirect (OAuth / email). */
export async function prepareAuthRedirectForProUpgrade(): Promise<void> {
  const file = getActiveWorkspaceFile();
  if (!file) return;

  try {
    await saveProUpgradeResume(file);
  } catch (err) {
    if (isStorageAccessError(err)) {
      console.warn('[auth] Pro upgrade resume skipped — browser storage restricted', err);
      return;
    }
    console.warn('[auth] Pro upgrade resume skipped', err);
  }
}
