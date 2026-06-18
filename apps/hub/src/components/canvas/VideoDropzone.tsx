import { useCallback, useRef } from 'react';
import {
  formatVideoLimitLabel,
  isVideoFile,
  isVideoWithinMemoryLimit,
  VIDEO_MEMORY_ERROR,
} from '../../lib/video/videoMemoryLimits';

interface Props {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  onError: (message: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoDropzone({ file, onFile, onClear, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const picked = files?.[0];
      if (!picked) return;
      if (!isVideoFile(picked)) {
        onError('Please choose a video file (MP4, WebM, MOV, MKV, etc.).');
        return;
      }
      if (!isVideoWithinMemoryLimit(picked)) {
        onError(VIDEO_MEMORY_ERROR);
        return;
      }
      onFile(picked);
    },
    [onError, onFile],
  );

  return (
    <div className="rounded-2xl border border-dashed border-canvas-border bg-canvas-surface p-5 sm:p-6">
      {file ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
            <p className="mt-1 text-xs font-medium text-slate-300">
              {formatSize(file.size)} · ready for local FFmpeg processing
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-canvas-surface"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl border border-canvas-border px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-rose-300"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 py-6 text-center transition hover:opacity-90"
        >
          <span className="text-3xl" aria-hidden="true">
            🎬
          </span>
          <span className="text-base font-semibold text-white">Drop or choose a video</span>
          <span className="max-w-md text-sm font-medium leading-relaxed text-slate-200">
            Safe limit: {formatVideoLimitLabel()}. Processing stays in this browser tab — nothing is sent to
            Cloudflare.
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.m4v,.mkv"
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
