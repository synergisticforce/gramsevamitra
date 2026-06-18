/** Contextual toolbar actions for Document Studio (Component C). */

export type DocumentActionTier = 'free' | 'pro';

export interface DocumentCanvasAction {
  id: string;
  label: string;
  icon: string;
  tier: DocumentActionTier;
  /** When set, action only appears for matching MIME types (supports `image/*` prefix). */
  mimePatterns?: string[];
  /** Pro upgrade modal copy (Component D). */
  featureId?: string;
  featureName?: string;
  featureDescription?: string;
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
    id: 'deskew',
    label: 'Straighten',
    icon: '📐',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'remove-pages',
    label: 'Remove Pages',
    icon: '🗑️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'page-numbers',
    label: 'Page Numbers',
    icon: '🔢',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'crop',
    label: 'Crop Page',
    icon: '🔲',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'image-to-pdf',
    label: 'To PDF',
    icon: '🖼️',
    tier: 'free',
    mimePatterns: ['image/'],
  },
  {
    id: 'pdf-to-image',
    label: 'To JPG/PNG',
    icon: '📸',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'pdf-to-text',
    label: 'Extract Text',
    icon: '📝',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'extract-to-word',
    label: 'Extract to Word',
    icon: '📃',
    tier: 'free',
    mimePatterns: ['application/pdf', 'image/'],
  },
  {
    id: 'type-save',
    label: 'Type & Save',
    icon: '✍️',
    tier: 'free',
  },
  {
    id: 'rotate',
    label: 'Rotate',
    icon: '🔄',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'reorder',
    label: 'Reorder',
    icon: '↕️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'watermark',
    label: 'Watermark',
    icon: '💧',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'organise-pages',
    label: 'Organise',
    icon: '📑',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'repair-pdf',
    label: 'Repair PDF',
    icon: '🛠️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'photo-scanned-pdf',
    label: 'Scanned PDF',
    icon: '📠',
    tier: 'free',
    mimePatterns: ['image/'],
  },
  {
    id: 'strip-metadata',
    label: 'Strip Metadata',
    icon: '🧹',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'sign-pdf',
    label: 'Sign PDF',
    icon: '✒️',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'redact-pdf',
    label: 'Redact',
    icon: '⬛',
    tier: 'free',
    mimePatterns: ['application/pdf'],
  },
  {
    id: 'smart-extract',
    label: 'Smart Extract',
    icon: '⚡',
    tier: 'pro',
    mimePatterns: ['application/pdf', 'image/'],
    featureId: 'smart-document-extractor',
    featureName: 'Smart Document Extractor',
    featureDescription:
      'Extract invoices and bank statements to CSV/JSON, or high-fidelity DOCX — powered by Advanced AI Document Extraction.',
  },
  {
    id: 'hifi-convert',
    label: 'Hi-Fi Convert',
    icon: '⚡',
    tier: 'pro',
    mimePatterns: ['application/pdf'],
    featureId: 'high-fidelity-converter',
    featureName: 'High-Fidelity File Converter',
    featureDescription:
      'Convert PDFs to editable DOCX or PPTX with layout preservation — powered by our advanced Pro conversion pipeline.',
  },
];

export function mimeMatchesPattern(mimeType: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return mimeType.startsWith(pattern);
  }
  return mimeType === pattern;
}

/** Resolve MIME from type + filename when the browser reports octet-stream or empty. */
export function resolveDocumentMime(mimeType: string, fileName: string): string {
  const name = fileName.toLowerCase();
  if (mimeType && mimeType !== 'application/octet-stream') {
    if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'application/pdf';
    if (mimeType.startsWith('image/')) return mimeType;
  }
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (/\.(jpe?g)$/.test(name)) return 'image/jpeg';
  return mimeType || 'application/octet-stream';
}

export function actionsForMimeType(mimeType: string, fileName = ''): DocumentCanvasAction[] {
  const resolved = resolveDocumentMime(mimeType, fileName);
  return DOCUMENT_CANVAS_ACTIONS.filter((action) => {
    if (!action.mimePatterns?.length) return true;
    return action.mimePatterns.some((pattern) => mimeMatchesPattern(resolved, pattern));
  });
}

/** Toolbar actions for empty canvas (full catalog) or after a file is loaded (MIME-filtered). */
export function documentToolbarActions(
  hasFile: boolean,
  mimeType = '',
  fileName = '',
): DocumentCanvasAction[] {
  if (!hasFile) {
    return DOCUMENT_CANVAS_ACTIONS;
  }
  return actionsForMimeType(mimeType, fileName);
}

export function getDocumentCanvasAction(actionId: string): DocumentCanvasAction | undefined {
  return DOCUMENT_CANVAS_ACTIONS.find((action) => action.id === actionId);
}

export const DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
