/** Contextual toolbar actions for Career Prep (Phase 6.1 + Phase 4 migration). */

export type CareerActionTier = 'free' | 'pro';

export interface CareerCanvasAction {
  id: string;
  label: string;
  icon: string;
  tier: CareerActionTier;
  /** When true, user must have a document on the canvas before opening this tool. */
  requiresDocument?: boolean;
  mimePatterns?: string[];
  featureId?: string;
  featureName?: string;
  featureDescription?: string;
}

export const CAREER_ACCEPT =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc';

const CAREER_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export function isCareerDocumentMimeOrName(type: string, name: string): boolean {
  if (CAREER_MIMES.has(type)) return true;
  return /\.(pdf|docx?)$/i.test(name);
}

export const CAREER_CANVAS_ACTIONS: CareerCanvasAction[] = [
  {
    id: 'legal-templates',
    label: 'Legal Docs',
    icon: '📜',
    tier: 'free',
  },
  {
    id: 'skill-gap-analyzer',
    label: 'Skill Gap',
    icon: '🎯',
    tier: 'free',
  },
  {
    id: 'business-card',
    label: 'Biz Card',
    icon: '🪪',
    tier: 'free',
  },
  {
    id: 'ats-scanner',
    label: 'ATS Scanner',
    icon: '🔍',
    tier: 'free',
    requiresDocument: true,
    mimePatterns: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  },
  {
    id: 'cover-letter-templates',
    label: 'Cover Letter Templates',
    icon: '📄',
    tier: 'free',
    requiresDocument: true,
    mimePatterns: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
  },
  {
    id: 'ai-resume-rewriter',
    label: 'AI Resume Rewriter',
    icon: '⚡',
    tier: 'free',
    requiresDocument: true,
    mimePatterns: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    featureId: 'ai-resume-rewriter',
    featureName: 'AI Resume Rewriter',
    featureDescription: 'Rewrite resume bullets from the text already in your file. Three free generations per month.',
  },
  {
    id: 'ai-cover-letter',
    label: 'AI Cover Letter',
    icon: '⚡',
    tier: 'free',
    requiresDocument: true,
    mimePatterns: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    featureId: 'ai-cover-letter',
    featureName: 'AI Cover Letter Generator',
    featureDescription: 'Draft a cover letter from your resume and an optional job description.',
  },
  {
    id: 'ai-interview-coach',
    label: 'Interview Coach',
    icon: '🗣️',
    tier: 'free',
    requiresDocument: true,
    mimePatterns: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    featureId: 'ai-interview-coach',
    featureName: 'Interview Coach',
    featureDescription: 'Practice questions and answers drawn only from your resume.',
  },
];

export function mimeMatchesPattern(mimeType: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return mimeType.startsWith(pattern);
  }
  return mimeType === pattern;
}

export function careerToolbarActions(hasDocument: boolean, mimeType = '', fileName = ''): CareerCanvasAction[] {
  if (!hasDocument) return [];

  const resolvedMime =
    mimeType && mimeType !== 'application/octet-stream'
      ? mimeType
      : /\.pdf$/i.test(fileName)
        ? 'application/pdf'
        : /\.docx?$/i.test(fileName)
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : mimeType;

  return CAREER_CANVAS_ACTIONS.filter((action) => {
    const needsDoc = action.requiresDocument ?? false;
    if (needsDoc && !hasDocument) return false;
    if (!needsDoc) return true;
    if (!action.mimePatterns?.length) return hasDocument;
    return action.mimePatterns.some((pattern) => mimeMatchesPattern(resolvedMime, pattern));
  });
}

/** @deprecated Use careerToolbarActions */
export function actionsForCareerMime(mimeType: string): CareerCanvasAction[] {
  return careerToolbarActions(true, mimeType);
}

export function getCareerCanvasAction(actionId: string): CareerCanvasAction | undefined {
  return CAREER_CANVAS_ACTIONS.find((action) => action.id === actionId);
}
