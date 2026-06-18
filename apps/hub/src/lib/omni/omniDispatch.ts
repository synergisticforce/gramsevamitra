import type { AppWorkspaceId } from '../../config/appWorkspaces';

/** Document Studio modal ids (Tier 1 free tools). */
export type DocumentOmniModal =
  | 'split'
  | 'merge'
  | 'compress'
  | 'protect'
  | 'unlock'
  | 'pdf-to-text'
  | 'pdf-to-image'
  | 'image-to-pdf';

/** Image Studio modal ids. */
export type MediaOmniModal = 'resize-compress' | 'convert-format' | 'exam-photo-optimizer';

/** Career Prep modal ids. */
export type CareerOmniModal = 'ats-scanner';

/** Omni intent → Document Studio tool modal. */
export const DOCUMENT_OMNI_MODAL: Partial<Record<string, DocumentOmniModal>> = {
  compress: 'compress',
  merge: 'merge',
  split: 'split',
  protect: 'protect',
};

/** Omni intent → Document Studio toolbar action id (Pro or special). */
export const DOCUMENT_OMNI_ACTION: Partial<Record<string, string>> = {
  'smart-extract': 'to-editable-format',
  'extract-text': 'to-editable-format',
  'to-editable-format': 'to-editable-format',
};

/** Omni intent → Image Studio tool modal. */
export const MEDIA_OMNI_MODAL: Partial<Record<string, MediaOmniModal>> = {
  'resize-compress': 'resize-compress',
  'convert-format': 'convert-format',
};

/** Omni intent → Image Studio Pro toolbar action id. */
export const MEDIA_OMNI_ACTION: Partial<Record<string, string>> = {
  'remove-background': 'remove-background',
};

/** Omni intent → Career Prep tool modal. */
export const CAREER_OMNI_MODAL: Partial<Record<string, CareerOmniModal>> = {
  'career-scan': 'ats-scanner',
};

export const DOCUMENT_PDF_ONLY_MODALS = new Set<DocumentOmniModal>([
  'split',
  'merge',
  'compress',
  'protect',
  'unlock',
  'pdf-to-text',
  'pdf-to-image',
]);

export function resolveDocumentOmniModal(intentId: string): DocumentOmniModal | null {
  return DOCUMENT_OMNI_MODAL[intentId] ?? null;
}

export function resolveDocumentOmniAction(intentId: string): string | null {
  return DOCUMENT_OMNI_ACTION[intentId] ?? null;
}

export function resolveMediaOmniModal(intentId: string): MediaOmniModal | null {
  return MEDIA_OMNI_MODAL[intentId] ?? null;
}

export function resolveMediaOmniAction(intentId: string): string | null {
  return MEDIA_OMNI_ACTION[intentId] ?? null;
}

export function resolveCareerOmniModal(intentId: string): CareerOmniModal | null {
  return CAREER_OMNI_MODAL[intentId] ?? null;
}

export function isOmniIntentForWorkspace(intentId: string, workspaceId: AppWorkspaceId): boolean {
  switch (workspaceId) {
    case 'documents':
      return Boolean(resolveDocumentOmniModal(intentId) || resolveDocumentOmniAction(intentId));
    case 'image':
      return Boolean(resolveMediaOmniModal(intentId) || resolveMediaOmniAction(intentId));
    case 'career':
      return Boolean(resolveCareerOmniModal(intentId));
    default:
      return false;
  }
}
