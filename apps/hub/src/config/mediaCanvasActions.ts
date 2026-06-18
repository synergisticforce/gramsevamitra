/** Contextual toolbar actions for Media Lab (Phase 4.5). */

export type MediaActionTier = 'free' | 'pro';

export interface MediaCanvasAction {
  id: string;
  label: string;
  icon: string;
  tier: MediaActionTier;
  mimePatterns?: string[];
  featureId?: string;
  featureName?: string;
  featureDescription?: string;
}

export const MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);

export function isImageMimeOrName(type: string, name: string): boolean {
  if (IMAGE_MIMES.has(type) || (type.startsWith('image/') && type.includes('jpeg'))) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(name);
}

export const MEDIA_CANVAS_ACTIONS: MediaCanvasAction[] = [
  {
    id: 'exam-photo-optimizer',
    label: 'Exam Photo',
    icon: '📋',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'resize-compress',
    label: 'Resize & Compress',
    icon: '🖼️',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'convert-format',
    label: 'Convert Format',
    icon: '🔄',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'image-cropper',
    label: 'Crop Image',
    icon: '✂️',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'image-watermark',
    label: 'Watermark',
    icon: '💧',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'image-to-pdf',
    label: 'Image to PDF',
    icon: '📄',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'image-filters',
    label: 'Filters',
    icon: '🎨',
    tier: 'free',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'remove-background',
    label: 'Remove Background',
    icon: '✂️',
    tier: 'pro',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
    featureId: 'remove-background',
    featureName: 'AI Background Removal',
    featureDescription:
      'Remove backgrounds from exam photos and ID scans with advanced AI — powered by GramSeva Mitra Pro.',
  },
  {
    id: 'upscale-4x',
    label: 'Upscale 4x',
    icon: '🔍',
    tier: 'pro',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
    featureId: 'upscale-4x',
    featureName: '4× AI Upscale',
    featureDescription:
      'Enhance low-resolution scans up to 4× with advanced AI super-resolution — Pro only.',
  },
  {
    id: 'photo-restore',
    label: 'AI Restore',
    icon: '⚡',
    tier: 'pro',
    mimePatterns: ['image/jpeg', 'image/png', 'image/webp'],
    featureId: 'photo-restore',
    featureName: 'AI Photo Restoration',
    featureDescription:
      'Colorize and repair old or damaged photos with advanced AI — powered by GramSeva Mitra Pro.',
  },
];

export function mimeMatchesPattern(mimeType: string, pattern: string): boolean {
  if (pattern.endsWith('/')) {
    return mimeType.startsWith(pattern);
  }
  return mimeType === pattern;
}

export function actionsForImageMime(mimeType: string): MediaCanvasAction[] {
  return MEDIA_CANVAS_ACTIONS.filter((action) => {
    if (!action.mimePatterns?.length) return true;
    return action.mimePatterns.some((pattern) => mimeMatchesPattern(mimeType, pattern));
  });
}

export function getMediaCanvasAction(actionId: string): MediaCanvasAction | undefined {
  return MEDIA_CANVAS_ACTIONS.find((action) => action.id === actionId);
}
