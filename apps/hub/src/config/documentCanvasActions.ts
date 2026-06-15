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

export function actionsForMimeType(mimeType: string): DocumentCanvasAction[] {
  return DOCUMENT_CANVAS_ACTIONS.filter((action) => {
    if (!action.mimePatterns?.length) return true;
    return action.mimePatterns.some((pattern) => mimeMatchesPattern(mimeType, pattern));
  });
}

export function getDocumentCanvasAction(actionId: string): DocumentCanvasAction | undefined {
  return DOCUMENT_CANVAS_ACTIONS.find((action) => action.id === actionId);
}

export const DOCUMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp,.pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
