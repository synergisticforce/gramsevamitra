import { useEffect, useRef, useState } from 'react';
import VideoScrubber from '../../components/VideoScrubber';
import VideoToolsPanel from '../../components/VideoToolsPanel';
import { readUriAsVideoBlob, useVideoEditor } from '../../hooks/useVideoEditor';
import { localVaultService } from '../../../shared/services/LocalVaultService';
import VaultScreen from '../VaultScreen';

export default function VideoStudioScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    selectVideo,
    trimVideo,
    compressVideo,
    extractAudio,
    isProcessing,
    error,
    clearError,
  } = useVideoEditor();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedFileId, setSavedFileId] = useState<string | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);
  const [showVault, setShowVault] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeError = localError ?? error;
  const processing = busy || isProcessing;

  const handleSelect = async () => {
    clearError();
    setLocalError(null);
    setSuccess(null);
    setToast(null);
    setSavedFileId(null);
    setSavedFileName(null);

    const url = await selectVideo();
    if (!url) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setStartTime(0);
    setEndTime(0);
    setDuration(0);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextDuration = Number.isFinite(video.duration) ? video.duration : 0;
    setDuration(nextDuration);
    setStartTime(0);
    setEndTime(nextDuration > 0 ? nextDuration : 0);
  };

  const saveOutputAndOpenVault = async (
    outputPath: string,
    fileName: string,
    mimeType: string,
    successMessage: string,
  ) => {
    const blob = await readUriAsVideoBlob(outputPath);
    const id = await localVaultService.saveFile(blob, fileName, mimeType);
    setSavedFileId(id);
    setSavedFileName(fileName);
    setSuccess(successMessage);
    setShowVault(true);
  };

  const handleTrimAndSave = async () => {
    if (!previewUrl) {
      setLocalError('Select a video before trimming.');
      return;
    }

    setBusy(true);
    setLocalError(null);
    setSuccess(null);

    try {
      const outputPath = await trimVideo(previewUrl, { startTime, endTime });
      await saveOutputAndOpenVault(
        outputPath,
        'Trimmed_Video.mp4',
        'video/mp4',
        'Trimmed video saved to Local Vault.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Trim & save failed.';
      setLocalError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleCompress = async () => {
    if (!previewUrl) {
      setLocalError('Select a video before compressing.');
      return;
    }

    setBusy(true);
    setLocalError(null);
    setSuccess(null);
    setToast(null);

    try {
      const outputPath = await compressVideo(previewUrl, { quality: 50 });
      await saveOutputAndOpenVault(
        outputPath,
        'Compressed_Video.mp4',
        'video/mp4',
        'Compressed video saved to Local Vault.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Compression failed.';
      setLocalError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleExtractAudio = async () => {
    if (!previewUrl) {
      setLocalError('Select a video before extracting audio.');
      return;
    }

    setBusy(true);
    setLocalError(null);
    setToast(null);

    try {
      await extractAudio(previewUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio extraction failed.';
      if (message === 'Audio extraction is in development.') {
        setToast(message);
        setLocalError(null);
        clearError();
      } else {
        setLocalError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  if (showVault) {
    return (
      <VaultScreen
        onBack={() => setShowVault(false)}
        highlightFileId={savedFileId}
        highlightFileName={savedFileName}
      />
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          Video Studio
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">Trim your video</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Pick a clip from your device, set start and end points, then trim or compress with the native
          Android engine — saved offline to your vault.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface">
        {previewUrl ? (
          <video
            ref={videoRef}
            src={previewUrl}
            controls
            playsInline
            className="mx-auto max-h-[42vh] w-full bg-black object-contain"
            onLoadedMetadata={handleLoadedMetadata}
          />
        ) : (
          <button
            type="button"
            onClick={() => void handleSelect()}
            disabled={processing}
            className="flex min-h-[260px] w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center disabled:opacity-60"
          >
            <span className="text-4xl" aria-hidden="true">
              🎬
            </span>
            <span className="text-sm font-semibold text-canvas-text">Tap to select a video</span>
            <span className="text-xs font-medium text-slate-300">
              MP4 / MOV from your camera roll — stays on this device
            </span>
          </button>
        )}
      </div>

      {previewUrl && duration > 0 && (
        <VideoScrubber
          duration={duration}
          startTime={startTime}
          endTime={endTime}
          disabled={processing}
          onChange={(nextStart, nextEnd) => {
            setStartTime(nextStart);
            setEndTime(nextEnd);
            const video = videoRef.current;
            if (video) {
              video.currentTime = nextStart;
            }
          }}
        />
      )}

      {previewUrl && (
        <VideoToolsPanel
          disabled={processing}
          onCompress={() => void handleCompress()}
          onExtractAudio={() => void handleExtractAudio()}
        />
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleSelect()}
          disabled={processing}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
        >
          {previewUrl ? 'Replace video' : 'Select video'}
        </button>
        <button
          type="button"
          onClick={() => void handleTrimAndSave()}
          disabled={processing || !previewUrl || endTime <= startTime}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {processing ? 'Processing…' : 'Trim & Save'}
        </button>
      </div>

      {activeError && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200"
          role="alert"
        >
          {activeError}
        </p>
      )}
      {toast && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-accent-muted px-3 py-2 text-sm font-medium text-canvas-text"
          role="status"
        >
          {toast}
        </p>
      )}
      {success && !showVault && (
        <p
          className="rounded-xl border border-emerald-500/40 bg-canvas-accent-soft px-3 py-2 text-sm font-medium text-canvas-text"
          role="status"
        >
          {success}
        </p>
      )}
    </section>
  );
}
