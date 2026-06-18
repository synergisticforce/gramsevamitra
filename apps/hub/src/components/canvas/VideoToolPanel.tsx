import { useEffect, useMemo, useState } from 'react';
import type { VideoToolId } from '../../config/videoCanvasTools';
import {
  VIDEO_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/videoCanvasStorage';
import {
  compressVideo,
  convertVideoFormat,
  extractMp3FromVideo,
  muteVideo,
  videoToGif,
  type CompressPreset,
  type VideoJobProgress,
  type VideoOutputFormat,
} from '../../lib/video/videoProcess';

interface Props {
  toolId: VideoToolId;
  file: File;
  disabled: boolean;
  onProgress: (progress: VideoJobProgress) => void;
  onProcessingEnd: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const INPUT_CLASS =
  'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

export default function VideoToolPanel({
  toolId,
  file,
  disabled,
  onProgress,
  onProcessingEnd,
  onSuccess,
  onError,
}: Props) {
  const initialCompress = useMemo(
    () => loadPersistedJson<{ preset: CompressPreset }>(VIDEO_STORAGE_KEYS.compressPreset, { preset: '720p' }),
    [],
  );
  const initialFormat = useMemo(
    () => loadPersistedJson<{ format: VideoOutputFormat }>(VIDEO_STORAGE_KEYS.outputFormat, { format: 'mp4' }),
    [],
  );
  const initialGif = useMemo(
    () =>
      loadPersistedJson(VIDEO_STORAGE_KEYS.gifOptions, {
        startSec: '0',
        durationSec: '5',
        fps: '10',
        width: '480',
      }),
    [],
  );

  const [compressPreset, setCompressPreset] = useState<CompressPreset>(initialCompress.preset);
  const [outputFormat, setOutputFormat] = useState<VideoOutputFormat>(initialFormat.format);
  const [gifStart, setGifStart] = useState(initialGif.startSec);
  const [gifDuration, setGifDuration] = useState(initialGif.durationSec);
  const [gifFps, setGifFps] = useState(initialGif.fps);
  const [gifWidth, setGifWidth] = useState(initialGif.width);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    savePersistedJson(VIDEO_STORAGE_KEYS.compressPreset, { preset: compressPreset });
  }, [compressPreset]);

  useEffect(() => {
    savePersistedJson(VIDEO_STORAGE_KEYS.outputFormat, { format: outputFormat });
  }, [outputFormat]);

  useEffect(() => {
    savePersistedJson(VIDEO_STORAGE_KEYS.gifOptions, {
      startSec: gifStart,
      durationSec: gifDuration,
      fps: gifFps,
      width: gifWidth,
    });
  }, [gifDuration, gifFps, gifStart, gifWidth]);

  const process = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      let resultFilename = 'output';

      switch (toolId) {
        case 'mp4-to-mp3':
          await extractMp3FromVideo(file, onProgress);
          resultFilename = 'audio.mp3';
          break;
        case 'video-compressor':
          await compressVideo(file, compressPreset, onProgress);
          resultFilename = `compressed_${compressPreset}.mp4`;
          break;
        case 'format-converter':
          await convertVideoFormat(file, outputFormat, onProgress);
          resultFilename = `converted.${outputFormat}`;
          break;
        case 'mute-video':
          await muteVideo(file, onProgress);
          resultFilename = 'muted.mp4';
          break;
        case 'video-to-gif':
          await videoToGif(
            file,
            {
              startSec: Number(gifStart) || 0,
              durationSec: Number(gifDuration) || 5,
              fps: Number(gifFps) || 10,
              width: Number(gifWidth) || 480,
            },
            onProgress,
          );
          resultFilename = 'output.gif';
          break;
        default:
          throw new Error('Unknown video tool.');
      }

      onSuccess(`Download started — ${resultFilename}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Video processing failed.');
    } finally {
      setBusy(false);
      onProcessingEnd();
    }
  };

  const isDisabled = disabled || busy;

  return (
    <div className="space-y-5">
      {toolId === 'video-compressor' && (
        <div className="flex flex-wrap gap-2">
          {(['720p', '480p'] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={isDisabled}
              onClick={() => setCompressPreset(preset)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                compressPreset === preset
                  ? 'bg-canvas-accent-muted text-white'
                  : 'border border-canvas-border bg-canvas-surface text-slate-200 hover:bg-canvas-elevated'
              }`}
            >
              {preset} H.264
            </button>
          ))}
        </div>
      )}

      {toolId === 'format-converter' && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Output format</span>
          <select
            value={outputFormat}
            disabled={isDisabled}
            onChange={(e) => setOutputFormat(e.target.value as VideoOutputFormat)}
            className={INPUT_CLASS}
          >
            <option value="mp4">MP4 (H.264 + AAC)</option>
            <option value="webm">WebM (VP9 + Opus)</option>
            <option value="mov">MOV (H.264 + AAC)</option>
          </select>
        </label>
      )}

      {toolId === 'video-to-gif' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Start (seconds)</span>
            <input
              type="number"
              min={0}
              step="0.1"
              value={gifStart}
              disabled={isDisabled}
              onChange={(e) => setGifStart(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Duration (seconds)</span>
            <input
              type="number"
              min={0.5}
              max={30}
              step="0.1"
              value={gifDuration}
              disabled={isDisabled}
              onChange={(e) => setGifDuration(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">FPS</span>
            <input
              type="number"
              min={5}
              max={20}
              value={gifFps}
              disabled={isDisabled}
              onChange={(e) => setGifFps(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-200">Width (px)</span>
            <input
              type="number"
              min={160}
              max={800}
              step={10}
              value={gifWidth}
              disabled={isDisabled}
              onChange={(e) => setGifWidth(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
      )}

      {(toolId === 'mp4-to-mp3' || toolId === 'mute-video') && (
        <p className="text-sm font-medium leading-relaxed text-slate-200">
          {toolId === 'mp4-to-mp3'
            ? 'Extracts the audio track as MP3 (LAME, quality q=2). Video stream is discarded.'
            : 'Copies the video stream and removes all audio — fast when stream copy is supported.'}
        </p>
      )}

      <button
        type="button"
        disabled={isDisabled}
        onClick={() => void process()}
        className="w-full rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-white transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isDisabled ? 'Processing…' : 'Process video locally'}
      </button>
    </div>
  );
}
