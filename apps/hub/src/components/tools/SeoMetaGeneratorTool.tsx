import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  analyzeDescription,
  analyzeTitle,
  buildMetaTags,
  serpDisplayUrl,
  type SeoFieldMetrics,
} from '../../lib/seo/seoMetaEngine';

const STORAGE_KEY = 'gsm-tools:seo-meta';

function MeterBar({ metrics, label }: { metrics: SeoFieldMetrics; label: string }) {
  const charPct = Math.min(100, (metrics.chars / metrics.charLimit) * 100);
  const pixelPct = Math.min(100, (metrics.pixels / metrics.pixelLimit) * 100);
  const statusColor = (s: SeoFieldMetrics['charStatus']) =>
    s === 'error' ? 'bg-rose-500' : s === 'warn' ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-400">{label}</span>
        <span
          className={
            metrics.charStatus === 'error' || metrics.pixelStatus === 'error'
              ? 'text-rose-400'
              : metrics.charStatus === 'warn' || metrics.pixelStatus === 'warn'
                ? 'text-amber-300'
                : 'text-emerald-400'
          }
        >
          {metrics.chars}/{metrics.charLimit} chars · {metrics.pixels}/{metrics.pixelLimit}px
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full ${statusColor(metrics.charStatus)}`} style={{ width: `${charPct}%` }} />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className={`h-full ${statusColor(metrics.pixelStatus)}`} style={{ width: `${pixelPct}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function SeoMetaGeneratorTool() {
  const [title, setTitle] = useState('GramSeva Mitra — Free Offline Tools for Everyone');
  const [description, setDescription] = useState(
    'Enterprise-grade calculators, PDF utilities, and career tools that run 100% in your browser. Private, fast, and free.',
  );
  const [canonicalUrl, setCanonicalUrl] = useState('https://gramsevamitra.com/tools');
  const [ogImage, setOgImage] = useState('');
  const [ogType, setOgType] = useState('website');
  const [siteName, setSiteName] = useState('GramSeva Mitra');
  const [copyLabel, setCopyLabel] = useState('Copy all tags');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, string>;
      if (s.title) setTitle(s.title);
      if (s.description) setDescription(s.description);
      if (s.canonicalUrl) setCanonicalUrl(s.canonicalUrl);
      if (s.ogImage) setOgImage(s.ogImage);
      if (s.ogType) setOgType(s.ogType);
      if (s.siteName) setSiteName(s.siteName);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ title, description, canonicalUrl, ogImage, ogType, siteName }),
      );
    } catch {
      /* ignore */
    }
  }, [title, description, canonicalUrl, ogImage, ogType, siteName]);

  const titleMetrics = useMemo(() => analyzeTitle(title), [title]);
  const descMetrics = useMemo(() => analyzeDescription(description), [description]);

  const metaTags = useMemo(
    () => buildMetaTags({ title, description, canonicalUrl, ogImage, ogType, siteName }),
    [title, description, canonicalUrl, ogImage, ogType, siteName],
  );

  const displayUrl = serpDisplayUrl(canonicalUrl);

  const copyTags = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(metaTags);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy all tags'), 2000);
    } catch {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Copy all tags'), 2000);
    }
  }, [metaTags]);

  const serpTitle =
    title.length > 65 ? `${title.slice(0, 62)}…` : title || 'Page Title — Your Site';
  const serpDesc =
    description.length > 165 ? `${description.slice(0, 162)}…` : description || 'Add a meta description…';

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">SEO inputs</h2>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full"
                placeholder="Page title for SERP"
              />
              <div className="mt-2">
                <MeterBar metrics={titleMetrics} label="Title compliance" />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Meta description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field w-full resize-none text-sm"
                placeholder="Search snippet description"
              />
              <div className="mt-2">
                <MeterBar metrics={descMetrics} label="Description compliance" />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Canonical URL</span>
              <input
                type="url"
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                className="input-field w-full"
                placeholder="https://example.com/page"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-300">Open Graph image URL</span>
              <input
                type="url"
                value={ogImage}
                onChange={(e) => setOgImage(e.target.value)}
                className="input-field w-full"
                placeholder="https://example.com/og-image.jpg"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">OG type</span>
                <select value={ogType} onChange={(e) => setOgType(e.target.value)} className="select-field w-full py-2 text-sm">
                  <option value="website">website</option>
                  <option value="article">article</option>
                  <option value="product">product</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-300">Site name</span>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="input-field w-full"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">Google SERP preview</h2>
            <div className="mt-4 rounded-xl border border-slate-700 bg-white p-4 text-left shadow-inner">
              <p className="truncate font-sans text-xl text-[#1a0dab]">{serpTitle}</p>
              <p className="mt-0.5 truncate font-sans text-sm text-[#006621]">{displayUrl}</p>
              <p className="mt-1 line-clamp-2 font-sans text-sm leading-snug text-[#545454]">{serpDesc}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/80">
              Facebook / X link card
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-700 bg-[#f0f2f5]">
              {ogImage ? (
                <div className="aspect-[1.91/1] w-full bg-slate-300">
                  <img src={ogImage} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ) : (
                <div className="flex aspect-[1.91/1] items-center justify-center bg-slate-300 text-sm text-slate-500">
                  OG image preview
                </div>
              )}
              <div className="border-t border-slate-300 bg-[#f0f2f5] px-3 py-2 text-left">
                <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">{displayUrl}</p>
                <p className="truncate text-sm font-semibold text-slate-900">{title || 'Link title'}</p>
                <p className="line-clamp-2 text-xs text-slate-600">{description || 'Link description preview'}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Generated meta tags</h2>
          <button type="button" onClick={copyTags} className="btn-secondary text-xs">
            {copyLabel}
          </button>
        </div>
        <textarea
          readOnly
          rows={14}
          value={metaTags}
          className="input-field w-full resize-y font-mono text-xs text-emerald-300"
          spellCheck={false}
        />
      </section>
    </div>
  );
}
