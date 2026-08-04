export interface VideoToolsPanelProps {
  disabled?: boolean;
  onCompress: () => void;
  onExtractAudio: () => void;
}

export default function VideoToolsPanel({
  disabled = false,
  onCompress,
  onExtractAudio,
}: VideoToolsPanelProps) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={onCompress}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Compress (Low Size)
      </button>
      <button
        type="button"
        onClick={onExtractAudio}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
      >
        Extract Audio (MP3)
      </button>
    </div>
  );
}
