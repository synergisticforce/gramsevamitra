/** Show the draft-saved badge after persisting form state to localStorage. */
export function showDraftSaved(badgeId = 'draft-saved-badge'): void {
  const el = document.getElementById(badgeId);
  if (!el) return;
  el.hidden = false;
}
