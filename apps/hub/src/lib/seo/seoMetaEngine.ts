export interface SeoFieldMetrics {
  chars: number;
  pixels: number;
  charLimit: number;
  pixelLimit: number;
  charStatus: 'ok' | 'warn' | 'error';
  pixelStatus: 'ok' | 'warn' | 'error';
}

export interface SeoInput {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
  ogType: string;
  siteName: string;
}

export const SEO_LIMITS = {
  titleChars: 60,
  titlePixels: 580,
  descChars: 160,
  descPixels: 990,
} as const;

const TITLE_FONT = '400 20px Arial, sans-serif';
const DESC_FONT = '400 14px Arial, sans-serif';

export function measureTextPx(text: string, font: string): number {
  if (typeof document === 'undefined') return text.length * 8;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function compliance(chars: number, pixels: number, charLimit: number, pixelLimit: number): SeoFieldMetrics {
  const charRatio = chars / charLimit;
  const pixelRatio = pixels / pixelLimit;
  const charStatus = charRatio > 1 ? 'error' : charRatio > 0.9 ? 'warn' : 'ok';
  const pixelStatus = pixelRatio > 1 ? 'error' : pixelRatio > 0.9 ? 'warn' : 'ok';
  return { chars, pixels: Math.round(pixels), charLimit, pixelLimit, charStatus, pixelStatus };
}

export function analyzeTitle(title: string): SeoFieldMetrics {
  return compliance(
    title.length,
    measureTextPx(title, TITLE_FONT),
    SEO_LIMITS.titleChars,
    SEO_LIMITS.titlePixels,
  );
}

export function analyzeDescription(description: string): SeoFieldMetrics {
  return compliance(
    description.length,
    measureTextPx(description, DESC_FONT),
    SEO_LIMITS.descChars,
    SEO_LIMITS.descPixels,
  );
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildMetaTags(input: SeoInput): string {
  const { title, description, canonicalUrl, ogImage, ogType, siteName } = input;
  const lines: string[] = [];

  if (title) lines.push(`<title>${escapeAttr(title)}</title>`);
  if (description) lines.push(`<meta name="description" content="${escapeAttr(description)}">`);
  lines.push('<meta name="robots" content="index, follow">');

  if (canonicalUrl) lines.push(`<link rel="canonical" href="${escapeAttr(canonicalUrl)}">`);

  if (title) lines.push(`<meta property="og:title" content="${escapeAttr(title)}">`);
  if (description) lines.push(`<meta property="og:description" content="${escapeAttr(description)}">`);
  if (canonicalUrl) lines.push(`<meta property="og:url" content="${escapeAttr(canonicalUrl)}">`);
  if (ogImage) lines.push(`<meta property="og:image" content="${escapeAttr(ogImage)}">`);
  lines.push(`<meta property="og:type" content="${escapeAttr(ogType || 'website')}">`);
  if (siteName) lines.push(`<meta property="og:site_name" content="${escapeAttr(siteName)}">`);

  lines.push(`<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}">`);
  if (title) lines.push(`<meta name="twitter:title" content="${escapeAttr(title)}">`);
  if (description) lines.push(`<meta name="twitter:description" content="${escapeAttr(description)}">`);
  if (ogImage) lines.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}">`);

  return lines.join('\n');
}

export function serpDisplayUrl(url: string): string {
  if (!url.trim()) return 'example.com › page';
  try {
    const u = new URL(url);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path}`.slice(0, 60);
  } catch {
    return url.replace(/^https?:\/\//, '').slice(0, 60);
  }
}
