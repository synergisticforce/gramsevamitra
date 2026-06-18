/** Phase 1 App Model — six consolidated workspace canvases. */
export type AppWorkspaceId = 'documents' | 'media' | 'career' | 'finance' | 'quick-tools' | 'lifestyle';

export interface AppWorkspace {
  id: AppWorkspaceId;
  label: string;
  href: `/workspace/${AppWorkspaceId}`;
  description: string;
  emoji: string;
}

export const APP_WORKSPACES: AppWorkspace[] = [
  {
    id: 'documents',
    label: 'Document Studio',
    href: '/workspace/documents',
    description: 'Merge, split, compress, protect, and smart-extract documents.',
    emoji: '📄',
  },
  {
    id: 'media',
    label: 'Media Lab',
    href: '/workspace/media',
    description: 'Resize exam photos, convert formats, and optimize images.',
    emoji: '🖼️',
  },
  {
    id: 'career',
    label: 'Career Prep',
    href: '/workspace/career',
    description: 'ATS scanning, resume rewriting, and job-search utilities.',
    emoji: '🎯',
  },
  {
    id: 'finance',
    label: 'Finance Hub',
    href: '/workspace/finance',
    description: 'EMI, GST, invoicing, and money calculators.',
    emoji: '💰',
  },
  {
    id: 'quick-tools',
    label: 'Quick Tools',
    href: '/workspace/quick-tools',
    description: 'Calculators, generators, and transient utilities.',
    emoji: '⚡',
  },
  {
    id: 'lifestyle',
    label: 'Health & Lifestyle',
    href: '/workspace/lifestyle',
    description: 'BMI, macros, exam age checks, cycle tracking, and mood journaling.',
    emoji: '🧘',
  },
];

export const DEFAULT_APP_WORKSPACE = APP_WORKSPACES[0];

export function resolveWorkspaceId(pathname: string): AppWorkspaceId | null {
  const match = APP_WORKSPACES.find(
    (ws) => pathname === ws.href || pathname.startsWith(`${ws.href}/`),
  );
  return match?.id ?? null;
}
