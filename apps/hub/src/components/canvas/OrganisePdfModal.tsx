import { useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import { organisePdfPagesInBrowser, triggerPdfDownload } from '../../lib/canvas/documentPdfTools';
import { requiresChunkedPipeline } from '../../lib/pdf/fileUploadLimits';
import { runChunkedOrganisePipeline } from '../../lib/upload/chunkedPipeline';
import { useModalMetaLoading } from '../../lib/canvas/useModalMetaLoading';
import ToolProcessingWait from './ToolProcessingWait';

interface PageCard {
  id: string;
  sourceIndex: number;
  thumbUrl: string;
}

interface Props {
  file: File;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onProcessingChange: (active: boolean, label: string, percent: number) => void;
}

export default function OrganisePdfModal({ file, onClose, onSuccess, onProcessingChange }: Props) {
  const [pages, setPages] = useState<PageCard[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sortableRef = useRef<Sortable | null>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  useModalMetaLoading(loadingMeta, busy, onProcessingChange, 'Loading page previews… Please wait');

  useEffect(() => {
    let cancelled = false;
    const thumbUrls: string[] = [];

    (async () => {
      setLoadingMeta(true);
      setError(null);
      try {
        const { getPdfPageCountFromFile } = await import('../../lib/pdf/pdfWorkerClient');
        const { renderPdfPageToCanvas, canvasToJpegBlob } = await import('../../lib/pdf/pdfRender');
        const count = await getPdfPageCountFromFile(file);
        const cards: PageCard[] = [];

        for (let i = 0; i < count; i += 1) {
          onProcessingChange(true, `Rendering preview ${i + 1} of ${count}…`, Math.round((i / count) * 40));
          const canvas = await renderPdfPageToCanvas(file, i + 1, 0.28);
          const blob = await canvasToJpegBlob(canvas, 0.72);
          const thumbUrl = URL.createObjectURL(blob);
          thumbUrls.push(thumbUrl);
          cards.push({ id: `page-${i}-${Date.now()}`, sourceIndex: i, thumbUrl });
        }

        if (cancelled) return;
        setPages(cards);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not read this PDF.');
      } finally {
        if (!cancelled) {
          onProcessingChange(false, '', 0);
          setLoadingMeta(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      thumbUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [file, onProcessingChange]);

  useEffect(() => {
    sortableRef.current?.destroy();
    sortableRef.current = null;
    const list = listRef.current;
    if (!list || loadingMeta) return;

    sortableRef.current = Sortable.create(list, {
      animation: 180,
      delay: 80,
      delayOnTouchOnly: true,
      ghostClass: 'opacity-40',
      handle: '.organise-drag-handle',
      onEnd: () => {
        const next: PageCard[] = [];
        list.querySelectorAll<HTMLElement>('[data-page-id]').forEach((el) => {
          const id = el.dataset.pageId;
          const found = pagesRef.current.find((p) => p.id === id);
          if (found) next.push(found);
        });
        if (next.length) setPages(next);
      },
    });

    return () => {
      sortableRef.current?.destroy();
      sortableRef.current = null;
    };
  }, [loadingMeta, pages.length]);

  const removePage = (id: string) => {
    setPages((prev) => {
      if (prev.length <= 1) {
        setError('Keep at least one page.');
        return prev;
      }
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.thumbUrl);
      return prev.filter((p) => p.id !== id);
    });
    setError(null);
  };

  const handleApply = useCallback(async () => {
    if (pages.length < 1) {
      setError('Keep at least one page.');
      return;
    }

    setBusy(true);
    setError(null);
    onProcessingChange(true, 'Organising pages…', 0);
    const order = pages.map((p) => p.sourceIndex);

    try {
      if (requiresChunkedPipeline(file)) {
        await runChunkedOrganisePipeline(file, order, ({ label, percent }) =>
          onProcessingChange(true, label, percent),
        );
        onProcessingChange(false, '', 0);
        onSuccess('Pages organised via Smart Slicing — download started.');
        onClose();
        return;
      }

      const { bytes, downloadName } = await organisePdfPagesInBrowser(
        file,
        order,
        ({ current, total, label }) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          onProcessingChange(true, label, percent);
        },
      );
      triggerPdfDownload(bytes, downloadName, '_organised');
      onProcessingChange(false, '', 0);
      onSuccess('Pages organised — download started.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Organise failed.');
      onProcessingChange(false, '', 0);
    } finally {
      setBusy(false);
    }
  }, [file, onClose, onProcessingChange, onSuccess, pages]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="organise-pdf-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="organise-pdf-title" className="text-lg font-bold text-canvas-text">
              Organise PDF Pages
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300 truncate">{file.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loadingMeta ? (
          <ToolProcessingWait label="Loading page previews…" className="mt-4" />
        ) : (
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-200">
            Drag pages to reorder. Tap ✕ to remove a page. Your final PDF keeps only the pages shown below.
          </p>
        )}

        {!loadingMeta && (
          <ul ref={listRef} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pages.map((page, position) => (
              <li
                key={page.id}
                data-page-id={page.id}
                className="organise-drag-handle relative cursor-grab rounded-xl border border-canvas-border bg-canvas-elevated p-2 active:cursor-grabbing"
              >
                <img
                  src={page.thumbUrl}
                  alt={`Page ${page.sourceIndex + 1}`}
                  className="aspect-[3/4] w-full rounded-lg object-cover"
                  draggable={false}
                />
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-slate-200">
                    #{position + 1} · p.{page.sourceIndex + 1}
                  </span>
                  <button
                    type="button"
                    disabled={busy || pages.length <= 1}
                    onClick={() => removePage(page.id)}
                    className="rounded-md border border-canvas-border px-1.5 py-0.5 text-[10px] font-semibold text-rose-200 hover:bg-canvas-danger-soft/30 disabled:opacity-40"
                    aria-label={`Remove page ${page.sourceIndex + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={busy || loadingMeta || pages.length < 1}
            className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save organised PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
