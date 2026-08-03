import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureFrameFromVideo,
  getScannerPlatform,
  isNativeAndroidScannerAvailable,
  scanDocumentWithMlKit,
} from '../../lib/native/documentScanner';

interface Props {
  open: boolean;
  onClose: () => void;
  onFilesCaptured: (files: File[]) => void;
  onError?: (message: string) => void;
}

/**
 * Platform-aware document capture:
 * - Android (Capacitor native): Google ML Kit Document Scanner with edge detection
 * - iOS / Web: live getUserMedia camera view with frame capture fallback
 */
export default function DocumentCameraScanner({
  open,
  onClose,
  onFilesCaptured,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const platform = getScannerPlatform();
  const useMlKit = isNativeAndroidScannerAvailable();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startWebCamera = useCallback(async () => {
    setError(null);
    setCameraReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      setCameraReady(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to open the camera. Check permissions and try again.';
      setError(message);
      onError?.(message);
    }
  }, [onError]);

  const launchMlKit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await scanDocumentWithMlKit({ pageLimit: 10, galleryImportAllowed: true });
      onFilesCaptured(result.files);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Document scan failed.';
      // User cancelled ML Kit UI — close quietly
      if (/cancel|dismiss|user.?cancel/i.test(message)) {
        onClose();
        return;
      }
      setError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }, [onClose, onError, onFilesCaptured]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      setBusy(false);
      return;
    }

    if (useMlKit) {
      void launchMlKit();
      return;
    }

    void startWebCamera();
    return () => stopCamera();
  }, [launchMlKit, open, startWebCamera, stopCamera, useMlKit]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    try {
      const file = captureFrameFromVideo(video, `scan-${Date.now()}.jpg`);
      stopCamera();
      onFilesCaptured([file]);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Capture failed.';
      setError(message);
      onError?.(message);
    }
  };

  const handleClose = () => {
    if (busy) return;
    stopCamera();
    onClose();
  };

  if (!open) return null;

  // Android ML Kit opens its own full-screen UI — show a light status overlay only.
  if (useMlKit) {
    return (
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-canvas-accent-muted/60 p-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div className="w-full max-w-sm rounded-2xl border border-canvas-border bg-canvas-surface px-5 py-6 text-center shadow-none">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-semibold text-canvas-text">
            {busy ? 'Opening ML Kit document scanner…' : 'Preparing scanner…'}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-300">
            High-performance edge detection on Android
          </p>
          {error && (
            <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          )}
          {error && (
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-camera-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-none">
        <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-5 py-4">
          <div>
            <h2 id="document-camera-title" className="text-lg font-bold text-canvas-text">
              Scan document
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
              {platform === 'ios'
                ? 'iOS camera capture — align the page and tap Capture'
                : 'Web camera capture — align the page and tap Capture'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="relative aspect-[3/4] w-full bg-black sm:aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="h-full w-full object-cover"
            aria-label="Live camera preview"
          />
          {!cameraReady && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 px-4 text-center">
              <p className="text-sm font-medium text-slate-200">Starting camera…</p>
            </div>
          )}
          {/* Simple alignment guide for web/iOS fallback */}
          <div
            className="pointer-events-none absolute inset-6 rounded-xl border-2 border-dashed border-white/50"
            aria-hidden="true"
          />
        </div>

        <div className="space-y-3 px-5 py-4">
          {error && (
            <p
              className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={!cameraReady}
              className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Capture page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
