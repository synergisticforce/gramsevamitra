/**
 * Canonical URLs for organic search indexing (launch sitemap allowlist).
 * Aligns with MASTER_PLAN.md — workspace canvases + marketing/legal only.
 */
export const SITE_ORIGIN = 'https://gramsevamitra.com';

/** Marketing and trust pages */
export const MARKETING_ROUTES = [
  '/',
  '/contact',
  '/privacy',
  '/terms',
  '/disclaimer',
] as const;

/** Seven core workspace canvases */
export const WORKSPACE_ROUTES = [
  '/workspace/documents',
  '/workspace/image',
  '/workspace/career',
  '/workspace/finance',
  '/workspace/quick-tools',
  '/workspace/lifestyle',
  '/workspace/video',
] as const;

/** In-app legal hub (Razorpay / compliance) */
export const LEGAL_ROUTES = [
  '/workspace/legal',
  '/workspace/legal/privacy',
  '/workspace/legal/terms',
  '/workspace/legal/refund',
] as const;

export const INDEXABLE_ROUTES = [
  ...MARKETING_ROUTES,
  ...WORKSPACE_ROUTES,
  ...LEGAL_ROUTES,
] as const;

export type IndexableRoute = (typeof INDEXABLE_ROUTES)[number];

const INDEXABLE_PATHS = new Set<string>(INDEXABLE_ROUTES);

/** Normalize Astro sitemap URLs to a comparable pathname. */
export function normalizeSitemapPath(url: string): string {
  const pathname = new URL(url, SITE_ORIGIN).pathname.replace(/\/+$/, '');
  return pathname === '' ? '/' : pathname;
}

export function isIndexableRoute(url: string): boolean {
  return INDEXABLE_PATHS.has(normalizeSitemapPath(url));
}

export function sitemapPriority(path: string): number {
  if (path === '/') return 1;
  if (WORKSPACE_ROUTES.includes(path as (typeof WORKSPACE_ROUTES)[number])) return 0.9;
  if (LEGAL_ROUTES.includes(path as (typeof LEGAL_ROUTES)[number])) return 0.6;
  return 0.7;
}

export function sitemapChangefreq(path: string): 'weekly' | 'monthly' {
  if (WORKSPACE_ROUTES.includes(path as (typeof WORKSPACE_ROUTES)[number])) return 'weekly';
  return 'monthly';
}
