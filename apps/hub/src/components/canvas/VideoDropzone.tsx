import { useCallback, useRef } from 'react';
import {
  formatVideoLimitLabel,
  isVideoFile,
  isVideoWithinMemoryLimit,
  VIDEO_MEMORY_ERROR,
} from '../../lib/video/videoMemoryLimits';

interface HeroProps {
  variant: 'hero';
  onFile: (file: File) => void;
  onError: (message: string) => void;
}

interface ReplaceProps {
  variant: 'replace';
  onFile: (file: File) => void;
  onError: (message: string) => void;
}

type Props = HeroProps | ReplaceProps;

export default function VideoDropzone(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const picked = files?.[0];
      if (!picked) return;
      if (!isVideoFile(picked)) {
        props.onError('Please choose a video file (MP4, WebM, MOV, MKV, etc.).');
        return;
      }
      if (!isVideoWithinMemoryLimit(picked)) {
        props.onError(VIDEO_MEMORY_ERROR);
        return;
      }
      props.onFile(picked);
    },
    [props],
  );

  if (props.variant === 'replace') {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
        >
          Replace video
        </button>
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
      </>
    );
  }

  return (
    <div className="w-full">
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

      <div
        className="relative flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-canvas-border bg-canvas-surface px-6 py-12 text-center transition hover:border-canvas-accent hover:bg-canvas-accent-soft/50 sm:min-h-[380px]"
        role="button"
        tabIndex={0}
        aria-label="Drop a video to begin"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className="text-5xl" aria-hidden="true">
          🎬
        </span>
        <p className="mt-4 text-lg font-semibold text-canvas-text">Drop or choose a video</p>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-200">
          Safe limit: {formatVideoLimitLabel()}. Processing stays on this device — nothing is uploaded
          to our servers.
        </p>
      </div>
    </div>
  );
}
