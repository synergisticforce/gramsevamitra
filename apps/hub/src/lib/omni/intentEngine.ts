import type { AppWorkspaceId } from '../../config/appWorkspaces';
import type { OmniFileCategory } from './blindDrop';

export type OmniIntentTier = 'free' | 'pro';

export interface OmniIntent {
  id: string;
  label: string;
  description: string;
  icon: string;
  tier: OmniIntentTier;
  /** Shown in Phase 1 quoting UI — e.g. "Instant & Free" or "2 AI Credits". */
  quoteLabel: string;
  workspaceId: AppWorkspaceId;
}

const PDF_INTENTS: OmniIntent[] = [
  {
    id: 'compress',
    label: 'Compress',
    description: 'Shrink PDF size locally in your browser',
    icon: '🗜️',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'extract-text',
    label: 'Extract Text',
    description: 'Pull selectable text without uploading',
    icon: '📝',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'merge',
    label: 'Merge',
    description: 'Combine with other PDF pages',
    icon: '🔗',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'split',
    label: 'Split',
    description: 'Separate pages into new files',
    icon: '✂️',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'protect',
    label: 'Protect',
    description: 'Add password encryption',
    icon: '🔒',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'smart-extract',
    label: 'Smart Extract',
    description: 'AI table & layout extraction (Pro)',
    icon: '⚡',
    tier: 'pro',
    quoteLabel: '2 AI Credits',
    workspaceId: 'documents',
  },
];

const IMAGE_INTENTS: OmniIntent[] = [
  {
    id: 'resize-compress',
    label: 'Resize & Compress',
    description: 'Exam photos, IDs, and form uploads',
    icon: '📐',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'image',
  },
  {
    id: 'convert-format',
    label: 'Convert Format',
    description: 'PNG, JPEG, WebP, and more',
    icon: '🔄',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'image',
  },
  {
    id: 'remove-background',
    label: 'Remove Background',
    description: 'Clean cutouts for documents',
    icon: '✨',
    tier: 'pro',
    quoteLabel: '2 AI Credits',
    workspaceId: 'image',
  },
];

const VIDEO_INTENTS: OmniIntent[] = [
  {
    id: 'compress-video',
    label: 'Compress',
    description: 'Reduce video size offline',
    icon: '🗜️',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'image',
  },
  {
    id: 'convert-video',
    label: 'Convert Format',
    description: 'Change container or codec',
    icon: '🔄',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'image',
  },
];

const AUDIO_INTENTS: OmniIntent[] = [
  {
    id: 'compress-audio',
    label: 'Compress',
    description: 'Smaller audio for sharing',
    icon: '🗜️',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'image',
  },
  {
    id: 'transcribe',
    label: 'Transcribe',
    description: 'Speech-to-text (Pro)',
    icon: '🎙️',
    tier: 'pro',
    quoteLabel: '3 AI Credits',
    workspaceId: 'image',
  },
];

const DOCUMENT_INTENTS: OmniIntent[] = [
  {
    id: 'extract-text-doc',
    label: 'Extract Text',
    description: 'Pull content from Word files',
    icon: '📝',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'convert-pdf',
    label: 'Convert to PDF',
    description: 'Export a print-ready PDF',
    icon: '📄',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
];

const SPREADSHEET_INTENTS: OmniIntent[] = [
  {
    id: 'extract-data',
    label: 'Extract Data',
    description: 'Preview rows and columns locally',
    icon: '📊',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'finance',
  },
  {
    id: 'convert-sheet',
    label: 'Convert Format',
    description: 'CSV, XLSX, and exports',
    icon: '🔄',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'finance',
  },
];

const PRESENTATION_INTENTS: OmniIntent[] = [
  {
    id: 'extract-slides',
    label: 'Extract Content',
    description: 'Pull slide text locally',
    icon: '📽️',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
  {
    id: 'convert-presentation',
    label: 'Convert to PDF',
    description: 'Share as a single document',
    icon: '📄',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'documents',
  },
];

const ARCHIVE_INTENTS: OmniIntent[] = [
  {
    id: 'extract-archive',
    label: 'Extract Files',
    description: 'Unpack ZIP and archives locally',
    icon: '📦',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'quick-tools',
  },
];

const TEXT_INTENTS: OmniIntent[] = [
  {
    id: 'analyze-text',
    label: 'Analyze & Format',
    description: 'Word count, case tools, and cleanup',
    icon: '🔍',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'quick-tools',
  },
  {
    id: 'career-scan',
    label: 'ATS Scan',
    description: 'Match resume text to a job',
    icon: '🎯',
    tier: 'free',
    quoteLabel: 'Instant & Free',
    workspaceId: 'career',
  },
];

const INTENTS_BY_CATEGORY: Record<Exclude<OmniFileCategory, 'unsupported'>, OmniIntent[]> = {
  pdf: PDF_INTENTS,
  image: IMAGE_INTENTS,
  video: VIDEO_INTENTS,
  audio: AUDIO_INTENTS,
  document: DOCUMENT_INTENTS,
  spreadsheet: SPREADSHEET_INTENTS,
  presentation: PRESENTATION_INTENTS,
  archive: ARCHIVE_INTENTS,
  text: TEXT_INTENTS,
};

/** Returns intent menu options for a recognized file category. */
export function resolveOmniIntents(category: OmniFileCategory): OmniIntent[] {
  if (category === 'unsupported') return [];
  return INTENTS_BY_CATEGORY[category] ?? [];
}

export function workspaceHref(workspaceId: AppWorkspaceId, intentId: string): string {
  return `/workspace/${workspaceId}?omni=${encodeURIComponent(intentId)}`;
}
