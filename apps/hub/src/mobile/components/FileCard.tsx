import type { FileMetadata } from '../../shared/services/LocalVaultService';

export interface FileCardProps {
  file: FileMetadata;
  onShare: (file: FileMetadata) => void;
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
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType === 'application/pdf') return '📄';
  return '📎';
}

export default function FileCard({ file, onShare, onDelete }: FileCardProps) {
  return (
    <article className="rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-3 shadow-none">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas-accent-soft text-xl"
          aria-hidden="true"
        >
          {mimeGlyph(file.mimeType)}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-canvas-text">{file.name}</h3>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">
            {formatFileSize(file.size)} · {formatCreatedDate(file.created)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onShare(file)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-canvas-accent-muted px-3 py-2.5 text-xs font-semibold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98]"
          aria-label={`Share ${file.name}`}
        >
          <span aria-hidden="true">↗</span>
          Share
        </button>
        <button
          type="button"
          onClick={() => onDelete(file.id)}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-canvas-border px-3 py-2.5 text-xs font-semibold text-rose-200 transition hover:bg-canvas-danger-soft/30 active:scale-[0.98]"
          aria-label={`Delete ${file.name}`}
        >
          <span aria-hidden="true">✕</span>
          Delete
        </button>
      </div>
    </article>
  );
}
