import { INTENT_TABS, type IntentTabId } from './toolsRegistry';

export interface PdfSegmentItem {
  id: string;
  label: string;
  href: string;
}

function tabLabel(id: IntentTabId, fallback: string): string {
  if (id === 'popular') return 'Popular';
  if (id === 'compress') return 'Compress';
  if (id === 'edit') return 'Edit';
  if (id === 'convert') return 'Convert';
  return fallback;
}

/** Workspaces 1–5 segment bar — maps to PDF studio category tabs. */
export const PDF_WORKSPACE_SEGMENTS: PdfSegmentItem[] = [
  { id: 'all', label: 'All', href: '/studio' },
  ...INTENT_TABS.filter((tab) => tab.id !== 'all').map((tab) => ({
    id: tab.id,
    label: tabLabel(tab.id, tab.label),
    href: `/studio?tab=${tab.id}`,
  })),
];

/** Standalone SEO routes → active studio segment for sub-navigation highlight. */
export const PDF_ROUTE_TO_SEGMENT: Record<string, IntentTabId | 'all'> = {
  '/': 'all',
  '/studio': 'all',
  '/compress': 'compress',
  '/scanner': 'compress',
  '/merge': 'popular',
  '/split': 'edit',
  '/watermark': 'edit',
  '/protect': 'edit',
  '/unlock': 'edit',
  '/image-to-pdf': 'convert',
};

export function resolvePdfSegmentId(pathname: string): string {
  return PDF_ROUTE_TO_SEGMENT[pathname] ?? 'all';
}

export function isPdfTabId(value: string): value is IntentTabId {
  return INTENT_TABS.some((tab) => tab.id === value);
}
