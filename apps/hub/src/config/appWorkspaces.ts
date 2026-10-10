/** Phase 1 App Model — seven consolidated workspace canvases. */
export type AppWorkspaceId =
  | 'documents'
  | 'image'
  | 'video'
  | 'lifestyle'
  | 'career'
  | 'finance'
  | 'quick-tools';

export interface AppWorkspace {
  id: AppWorkspaceId;
  label: string;
  /** Trailing slash matches the cached page, so the app opens offline. */
  href: `/workspace/${AppWorkspaceId}/`;
  description: string;
  emoji: string;
}

export const APP_WORKSPACES: AppWorkspace[] = [
  {
    id: 'documents',
    label: 'Document Studio',
    href: '/workspace/documents/',
    description: 'Merge, split, compress, protect, and smart-extract documents.',
    emoji: '📄',
  },
  {
    id: 'image',
    label: 'Image Studio',
    href: '/workspace/image/',
    description: 'Resize exam photos, convert formats, and optimize images.',
    emoji: '🖼️',
  },
  {
    id: 'video',
    label: 'Video Studio',
    href: '/workspace/video/',
    description: 'Compress, convert, extract audio, mute, and GIF tools — processed privately on your device.',
    emoji: '🎬',
  },
  {
    id: 'career',
    label: 'Career Prep',
    href: '/workspace/career/',
    description: 'ATS scanning, resume rewriting, and job-search utilities.',
    emoji: '🎯',
  },
  {
    id: 'lifestyle',
    label: 'Health & Lifestyle',
    href: '/workspace/lifestyle/',
    description: 'BMI, macros, exam age checks, cycle tracking, and mood journaling.',
    emoji: '🧘',
  },
  {
    id: 'finance',
    label: 'Finance Hub',
    href: '/workspace/finance/',
    description: 'EMI, GST, invoicing, and money calculators.',
    emoji: '💰',
  },
  {
    id: 'quick-tools',
    label: 'Quick Tools',
    href: '/workspace/quick-tools/',
    description: 'Calculators, generators, and transient utilities.',
    emoji: '⚡',
  },
];

export const DEFAULT_APP_WORKSPACE = APP_WORKSPACES[0];

function withoutTrailingSlash(pathname: string): string {
  const path = pathname.split('?')[0] ?? pathname;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

export function resolveWorkspaceId(pathname: string): AppWorkspaceId | null {
  const current = withoutTrailingSlash(pathname);
  const match = APP_WORKSPACES.find((ws) => {
    const href = withoutTrailingSlash(ws.href);
    return current === href || current.startsWith(`${href}/`);
  });
  return match?.id ?? null;
}

/** Legacy route alias — `/workspace/media` redirects to Image Studio. */
export const LEGACY_MEDIA_WORKSPACE_HREF = '/workspace/media';
