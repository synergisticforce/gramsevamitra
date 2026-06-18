import { useCallback, useEffect, useState } from 'react';
import type { VideoToolId } from '../../config/videoCanvasTools';
import { getVideoTool } from '../../config/videoCanvasTools';
import {
  loadVideoActiveTool,
  saveVideoActiveTool,
} from '../../lib/canvas/videoCanvasStorage';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import { VIDEO_PROCESSING_SUBTITLE } from '../../lib/video/videoMemoryLimits';
import type { VideoJobProgress } from '../../lib/video/videoProcess';
import CanvasProcessingOverlay from './CanvasProcessingOverlay';
import CanvasToast from './CanvasToast';
import VideoDropzone from './VideoDropzone';
import VideoToolGrid from './VideoToolGrid';
import VideoToolPanel from './VideoToolPanel';

type VideoView = 'grid' | VideoToolId;
type CanvasPhase = 'empty' | 'active';

interface ProcessingState {
  active: boolean;
  label: string;
  percent: number;
}

function renderVideoTool(
  toolId: VideoToolId,
  file: File,
  disabled: boolean,
  onProgress: (progress: VideoJobProgress) => void,
  onProcessingEnd: () => void,
  onSuccess: (message: string) => void,
  onError: (message: string) => void,
) {
  switch (toolId) {
    case 'mp4-to-mp3':
    case 'video-compressor':
    case 'format-converter':
    case 'mute-video':
    case 'video-to-gif':
      return (
        <VideoToolPanel
          toolId={toolId}
          file={file}
          disabled={disabled}
          onProgress={onProgress}
          onProcessingEnd={onProcessingEnd}
          onSuccess={onSuccess}
          onError={onError}
        />
      );
    default:
      return null;
  }
}

export default function VideoHubCanvas() {
  const [phase, setPhase] = useState<CanvasPhase>('empty');
  const [view, setView] = useState<VideoView>('grid');
  const [hydrated, setHydrated] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false,
    label: '',
    percent: 0,
  });

  const dismissToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    const saved = loadVideoActiveTool();
    if (saved) setView(saved);
    setHydrated(true);
  }, []);

  const activateFile = useCallback((next: File) => {
    setFile(next);
    setPhase('active');
    setView('grid');
    saveVideoActiveTool(null);
  }, []);

  const clearCanvas = useCallback(() => {
    setFile(null);
    setPhase('empty');
    setView('grid');
    saveVideoActiveTool(null);
  }, []);

  const openTool = useCallback((toolId: VideoToolId) => {
    setView(toolId);
    saveVideoActiveTool(toolId);
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    saveVideoActiveTool(null);
  }, []);

  const handleProgress = useCallback((progress: VideoJobProgress) => {
    setProcessing({ active: true, label: progress.label, percent: progress.percent });
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
        <p className="text-sm font-medium leading-relaxed text-slate-200">Loading Video Workspace…</p>
      </div>
    );
  }

  const activeTool = view !== 'grid' ? getVideoTool(view) : null;

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              🎬
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Video Studio</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                Five video tools — compress, convert, extract audio, mute, or create GIFs. Processed
                privately on your device; videos never touch our servers.
              </p>
            </div>
          </div>
        </header>

        {phase === 'empty' && (
          <VideoDropzone variant="hero" onFile={activateFile} onError={setToastMessage} />
        )}

        {phase === 'active' && file && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas-accent-soft text-2xl"
                    aria-hidden="true"
                  >
                    🎬
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-canvas-text">{file.name}</p>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">
                      {formatFileSize(file.size)}
                      {file.type ? ` · ${file.type}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <VideoDropzone
                    variant="replace"
                    onFile={activateFile}
                    onError={setToastMessage}
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center justify-center rounded-lg border border-canvas-border px-3 py-2 text-xs font-semibold text-canvas-muted transition hover:border-canvas-border hover:bg-canvas-danger-soft/30 hover:text-rose-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {view === 'grid' ? (
              <VideoToolGrid onSelectTool={openTool} />
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={backToGrid}
                  className="inline-flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-none transition hover:border-violet-300 hover:bg-canvas-elevated hover:text-white"
                >
                  <span aria-hidden="true">←</span> Back to Tools
                </button>

                {activeTool && (
                  <div className="rounded-2xl border border-canvas-border bg-canvas-elevated/50 p-4 sm:p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {activeTool.icon}
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-white">{activeTool.label}</h2>
                        <p className="text-sm font-medium leading-relaxed text-slate-200">
                          {activeTool.description}
                        </p>
                      </div>
                    </div>

                    {renderVideoTool(
                      view,
                      file,
                      processing.active,
                      handleProgress,
                      () => setProcessing({ active: false, label: '', percent: 0 }),
                      setToastMessage,
                      setToastMessage,
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {processing.active && (
        <CanvasProcessingOverlay
          label={processing.label}
          percent={processing.percent}
          subtitle={VIDEO_PROCESSING_SUBTITLE}
        />
      )}

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
