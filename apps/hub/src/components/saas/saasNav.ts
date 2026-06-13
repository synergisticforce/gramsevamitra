export type LegalSegmentId = 'privacy' | 'terms' | 'disclaimer';

export const LEGAL_SEGMENTS = [
  { id: 'privacy' as const, label: 'Privacy', href: '/privacy' },
  { id: 'terms' as const, label: 'Terms', href: '/terms' },
  { id: 'disclaimer' as const, label: 'Disclaimer', href: '/disclaimer' },
];

export type { SaaSNavKey } from '@shared/components/saas/saasNav';
