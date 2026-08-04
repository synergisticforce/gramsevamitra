import type { FileMetadata } from '../../shared/services/LocalVaultService';

export interface FileCardProps {
  file: FileMetadata;
  /** Optional override for the secondary line under the file name. */
  subtitle?: string;
  onOpen?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  onTools?: (file: FileMetadata) => void;
  onDelete: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCreatedDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function mimeGlyph(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType.startsWith('video/')) return 'VID';
  if (mimeType === 'application/pdf') return 'PDF';
  return 'FILE';
}

export default function FileCard({
  file,
  subtitle,
  onOpen,
  onShare,
  onTools,
  onDelete,
}: FileCardProps) {
  const metaLine = subtitle ?? `${formatFileSize(file.size)} · ${formatCreatedDate(file.created)}`;

  return (
    <article className="rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-3 shadow-none">
      <button
        type="button"
        onClick={onOpen ? () => onOpen(file) : undefined}
        disabled={!onOpen}
        className={`flex w-full items-start gap-3 text-left ${
          onOpen ? 'rounded-xl active:bg-canvas-elevated/60' : ''
        }`}
        aria-label={onOpen ? `Open ${file.name}` : undefined}
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas-accent-soft text-[10px] font-bold tracking-wide text-canvas-text"
          aria-hidden="true"
        >
          {mimeGlyph(file.mimeType)}
        </span>

        <div className="min-w-0 flex-1 py-0.5">
          <h3 className="truncate text-sm font-semibold text-canvas-text">{file.name}</h3>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">{metaLine}</p>
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(file)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-canvas-accent-muted px-3 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98]"
            aria-label={`View ${file.name}`}
          >
            View
          </button>
        )}
        {onTools && (
          <button
            type="button"
            onClick={() => onTools(file)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-canvas-border px-3 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-elevated active:scale-[0.98]"
            aria-label={`Tools for ${file.name}`}
          >
            Tools
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={() => onShare(file)}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-canvas-border px-3 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-elevated active:scale-[0.98]"
            aria-label={`Share ${file.name}`}
          >
            Share
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-canvas-border px-3 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-canvas-danger-soft/30 active:scale-[0.98]"
          aria-label={`Delete ${file.name}`}
        >
          Delete
        </button>
      </div>
    </article>
  );
}
