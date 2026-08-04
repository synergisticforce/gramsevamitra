import { useCallback, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export interface VideoTrimOptions {
  startTime: number;
  endTime: number;
}

export interface CompressOptions {
  quality: number;
}

export interface VideoEditorHookResult {
  selectVideo: () => Promise<string | null>;
  trimVideo: (sourceUri: string, options: VideoTrimOptions) => Promise<string>;
  compressVideo: (sourceUri: string, options: CompressOptions) => Promise<string>;
  extractAudio: (sourceUri: string) => Promise<string>;
  isProcessing: boolean;
  error: string | null;
  clearError: () => void;
  getSelectedFile: () => File | null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to encode video for native processing.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read video file.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function pickVideoViaHtmlInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.style.display = 'none';
    const cleanup = () => {
      input.remove();
    };
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };
    input.oncancel = () => {
      cleanup();
      resolve(null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

function assertNativePlatform(): void {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Video editing is optimized for the mobile app.');
  }
}

/** Map 1–100 quality to a WhatsApp-friendly max width while keeping aspect ratio. */
function resolutionForQuality(quality: number): { width: number; height: number; fps: number } {
  const q = Math.min(100, Math.max(1, quality));
  if (q <= 35) return { width: 480, height: 270, fps: 24 };
  if (q <= 65) return { width: 640, height: 360, fps: 24 };
  return { width: 960, height: 540, fps: 30 };
}

/**
 * Native video utilities via @whiteguru/capacitor-plugin-video-editor (`edit` + `transcode`/`trim`).
 */
export function useVideoEditor(): VideoEditorHookResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const nativeSourcePathRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const getSelectedFile = useCallback(() => selectedFileRef.current, []);

  const ensureNativeSourcePath = useCallback(async (): Promise<string> => {
    if (nativeSourcePathRef.current) return nativeSourcePathRef.current;

    const file = selectedFileRef.current;
    if (!file) {
      throw new Error('No source video is available.');
    }

    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const cachePath = `video-studio/source_${Date.now()}.mp4`;
    await Filesystem.writeFile({
      path: cachePath,
      data: await blobToBase64(file),
      directory: Directory.Cache,
      recursive: true,
    });
    const uriResult = await Filesystem.getUri({
      path: cachePath,
      directory: Directory.Cache,
    });
    nativeSourcePathRef.current = uriResult.uri;
    return uriResult.uri;
  }, []);

  const selectVideo = useCallback(async (): Promise<string | null> => {
    setError(null);
    setIsProcessing(true);

    try {
      const file = await pickVideoViaHtmlInput();
      if (!file) return null;

      selectedFileRef.current = file;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      nativeSourcePathRef.current = null;

      if (Capacitor.isNativePlatform()) {
        await ensureNativeSourcePath();
      }

      return previewUrl;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to select a video.';
      console.warn('[useVideoEditor] selectVideo failed:', message);
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [ensureNativeSourcePath]);

  const trimVideo = useCallback(
    async (_sourceUri: string, options: VideoTrimOptions): Promise<string> => {
      setError(null);

      try {
        assertNativePlatform();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Video editing is optimized for the mobile app.';
        setError(message);
        throw err;
      }

      if (options.endTime <= options.startTime) {
        const message = 'End time must be greater than start time.';
        setError(message);
        throw new Error(message);
      }

      setIsProcessing(true);

      try {
        const path = await ensureNativeSourcePath();
        const { VideoEditor } = await import('@whiteguru/capacitor-plugin-video-editor');
        const result = await VideoEditor.edit({
          path,
          trim: {
            startsAt: Math.max(0, Math.round(options.startTime * 1000)),
            endsAt: Math.max(0, Math.round(options.endTime * 1000)),
          },
        });

        const outputPath = result.file?.path;
        if (!outputPath) {
          throw new Error('Native trim completed but no output file was returned.');
        }
        return outputPath;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Native video trim failed.';
        console.warn('[useVideoEditor] trimVideo failed:', message);
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureNativeSourcePath],
  );

  const compressVideo = useCallback(
    async (_sourceUri: string, options: CompressOptions): Promise<string> => {
      setError(null);

      try {
        assertNativePlatform();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Video editing is optimized for the mobile app.';
        setError(message);
        throw err;
      }

      setIsProcessing(true);

      try {
        const path = await ensureNativeSourcePath();
        const { width, height, fps } = resolutionForQuality(options.quality);
        const { VideoEditor } = await import('@whiteguru/capacitor-plugin-video-editor');
        const result = await VideoEditor.edit({
          path,
          transcode: {
            width,
            height,
            keepAspectRatio: true,
            fps,
          },
        });

        const outputPath = result.file?.path;
        if (!outputPath) {
          throw new Error('Native compression completed but no output file was returned.');
        }
        return outputPath;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Native video compression failed.';
        console.warn('[useVideoEditor] compressVideo failed:', message);
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureNativeSourcePath],
  );

  const extractAudio = useCallback(async (_sourceUri: string): Promise<string> => {
    const message = 'Audio extraction is in development.';
    console.warn('[useVideoEditor] extractAudio:', message, {
      reason: '@whiteguru/capacitor-plugin-video-editor has no audio-only export API',
    });
    setError(message);
    throw new Error(message);
  }, []);

  return {
    selectVideo,
    trimVideo,
    compressVideo,
    extractAudio,
    isProcessing,
    error,
    clearError,
    getSelectedFile,
  };
}

export async function readUriAsVideoBlob(uri: string): Promise<Blob> {
  try {
    const src = Capacitor.convertFileSrc(uri);
    const response = await fetch(src);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return blob.type ? blob : new Blob([blob], { type: 'video/mp4' });
      }
    }
  } catch (err) {
    console.warn('[useVideoEditor] fetch output failed, trying Filesystem:', err);
  }

  const { Filesystem } = await import('@capacitor/filesystem');
  const result = await Filesystem.readFile({ path: uri });
  const data = typeof result.data === 'string' ? result.data : '';
  if (!data) {
    throw new Error('Unable to read the processed video.');
  }
  return base64ToBlob(data, 'video/mp4');
}
