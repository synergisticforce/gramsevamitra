import { getActiveWorkspaceFile } from './workspaceFileRegistry';
import { saveProUpgradeResume } from './workspaceResumeCache';

/** Persist canvas file + intent before Better Auth redirect (OAuth / email). */
export async function prepareAuthRedirectForProUpgrade(): Promise<void> {
  const file = getActiveWorkspaceFile();
  if (!file) return;
  await saveProUpgradeResume(file);
}
