import { downloadBlob } from '@shared/utils/fileUtils';
import { splitVideoBaseName } from './videoMemoryLimits';

export async function extractVideoFrameAsJpg(
  file: File,
  timeSec: number,
): Promise<{ blob: Blob; downloadName: string }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not load this video file.'));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seekTo = Math.max(0, Math.min(duration > 0 ? duration - 0.05 : timeSec, timeSec));

    await new Promise<void>((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = seekTo;
      video.onerror = () => reject(new Error('Could not seek to the selected time.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported in this browser.');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Failed to export frame.'))),
        'image/jpeg',
        0.92,
      );
    });

    const base = splitVideoBaseName(file.name);
    const stamp = seekTo.toFixed(1).replace('.', '-');
    return { blob, downloadName: `${base}-frame-${stamp}s.jpg` };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function triggerFrameDownload(blob: Blob, filename: string): void {
  downloadBlob(blob, filename, '_converted');
}
