import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  analyzeDescription,
  analyzeTitle,
  buildMetaTags,
  serpDisplayUrl,
} from '../../lib/seo/seoMetaEngine';

interface FormState {
  title: string;
  description: string;
  ogImage: string;
  canonicalUrl: string;
}

const DEFAULTS: FormState = {
  title: 'GramSeva Mitra — Free Offline Tools for Everyone',
  description:
    'Enterprise-grade calculators, PDF utilities, and career tools that run 100% in your browser. Private, fast, and free.',
  ogImage: '',
  canonicalUrl: 'https://gramsevamitra.com/workspace/quick-tools',
};

interface Props {
  onToast: (message: string) => void;
}

export default function QuickSeoMetaGenerator({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.seoMeta, DEFAULTS),
    []
  );
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [ogImage, setOgImage] = useState(initial.ogImage);
  const [canonicalUrl, setCanonicalUrl] = useState(initial.canonicalUrl);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.seoMeta, {
      title,
      description,
      ogImage,
      canonicalUrl,
    });
  }, [title, description, ogImage, canonicalUrl]);

  const titleMetrics = useMemo(() => analyzeTitle(title), [title]);
  const descMetrics = useMemo(() => analyzeDescription(description), [description]);

  const metaTags = useMemo(
    () =>
      buildMetaTags({
        title,
        description,
        canonicalUrl,
        ogImage,
        ogType: 'website',
        siteName: 'GramSeva Mitra',
      }),
    [title, description, canonicalUrl, ogImage]
  );

  const displayUrl = serpDisplayUrl(canonicalUrl);
  const serpTitle = title.length > 65 ? `${title.slice(0, 62)}…` : title || 'Page Title';
  const serpDesc =
    description.length > 165 ? `${description.slice(0, 162)}…` : description || 'Add a meta description…';

  const copyTags = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(metaTags);
      onToast('Meta tags copied to clipboard.');
    } catch {
      onToast('Copy failed — select and copy manually.');
    }
  }, [metaTags, onToast]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const meterColor = (status: 'ok' | 'warn' | 'error') =>
    status === 'error' ? 'bg-rose-500' : status === 'warn' ? 'bg-amber-400' : 'bg-canvas-accent-soft0';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">SEO inputs</h2>
        <label className="block text-sm font-medium text-canvas-muted">
          Title
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-1.5`} />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas-elevated">
            <div
              className={`h-full ${meterColor(titleMetrics.charStatus)}`}
              style={{ width: `${Math.min(100, (titleMetrics.chars / titleMetrics.charLimit) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-canvas-subtle">
            {titleMetrics.chars}/{titleMetrics.charLimit} characters
          </p>
        </label>
        <label className="block text-sm font-medium text-canvas-muted">
          Meta description
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputClass} mt-1.5 resize-none`}
          />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas-elevated">
            <div
              className={`h-full ${meterColor(descMetrics.charStatus)}`}
              style={{ width: `${Math.min(100, (descMetrics.chars / descMetrics.charLimit) * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-canvas-subtle">
            {descMetrics.chars}/{descMetrics.charLimit} characters
          </p>
        </label>
        <label className="block text-sm font-medium text-canvas-muted">
          Open Graph image URL
          <input type="url" value={ogImage} onChange={(e) => setOgImage(e.target.value)} className={`${inputClass} mt-1.5`} placeholder="https://example.com/og-image.jpg" />
        </label>
        <label className="block text-sm font-medium text-canvas-muted">
          Canonical URL
          <input type="url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} className={`${inputClass} mt-1.5`} />
        </label>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-accent">Google preview</h2>
          <div className="mt-4 rounded-xl border border-slate-100 bg-canvas-surface p-4 shadow-inner">
            <p className="truncate font-sans text-xl text-[#1a0dab]">{serpTitle}</p>
            <p className="mt-0.5 truncate font-sans text-sm text-[#006621]">{displayUrl}</p>
            <p className="mt-1 line-clamp-2 font-sans text-sm leading-snug text-[#545454]">{serpDesc}</p>
          </div>
        </div>
        {ogImage && (
          <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-none">
            <img src={ogImage} alt="" className="aspect-[1.91/1] w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Generated meta tags</h2>
          <button type="button" onClick={() => void copyTags()} className="rounded-xl bg-canvas-accent-muted px-4 py-2 text-xs font-semibold text-canvas-text hover:bg-canvas-accent/40">
            Copy all tags
          </button>
        </div>
        <textarea
          readOnly
          rows={12}
          value={metaTags}
          className="w-full resize-y rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 font-mono text-xs text-canvas-text outline-none"
          spellCheck={false}
        />
      </section>
    </div>
  );
}
