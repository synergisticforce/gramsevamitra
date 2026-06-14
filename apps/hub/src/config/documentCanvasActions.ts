/** Contextual toolbar actions for Document Studio (Component C). */

export type DocumentActionTier = 'free' | 'pro';

export interface DocumentCanvasAction {
  id: string;
  label: string;
  icon: string;
  tier: DocumentActionTier;
  /** When set, action only appears for matching MIME types (supports `image/*` prefix). */
  mimePatterns?: string[];
}

export const DOCUMENT_CANVAS_ACTIONS: DocumentCanvasAction[] = [
  {
    id: 'split',
    label: 'Split',
    icon: '✂️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'merge',
    label: 'Merge',
    icon: '🔗',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'compress',
    label: 'Compress',
    icon: '🗜️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'protect',
    label: 'Protect',
    icon: '🔒',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'unlock',
    label: 'Unlock',
    icon: '🔓',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'smart-extract',
    label: 'Smart Extract',
    icon: '⚡',
    tier: 'pro',
    mimePatterns: ['application/pdf', 'image/'],
  },
];

export function mimeMatchesPattern(mimeType: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return mimeType.startsWith(pattern);
  }
  return mimeType === pattern;
}

export function actionsForMimeType(mimeType: string): DocumentCanvasAction[] {
  return DOCUMENT_CANVAS_ACTIONS.filter((action) => {
    if (!action.mimePatterns?.length) return true;
    return action.mimePatterns.some((pattern) => mimeMatchesPattern(mimeType, pattern));
  });
}

export const DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
