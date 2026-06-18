import {
  assertVideoWithinMemoryLimit,
  splitVideoBaseName,
} from './videoMemoryLimits';
import {
  cleanupFiles,
  downloadVideoOutput,
  getFfmpeg,
  readOutputFile,
  writeInputFile,
} from './ffmpegClient';

export interface VideoJobProgress {
  label: string;
  percent: number;
}

type ProgressFn = (progress: VideoJobProgress) => void;

function inputExt(file: File): string {
  const match = file.name.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : 'mp4';
}

async function runJob(
  file: File,
  outputName: string,
  buildArgs: (inputName: string) => string[],
  onProgress: ProgressFn,
  mimeType: string,
): Promise<{ filename: string }> {
  assertVideoWithinMemoryLimit(file);
  const inputName = `input.${inputExt(file)}`;
  const base = splitVideoBaseName(file.name);

  onProgress({ label: 'Preparing video engine…', percent: 8 });
  const ffmpeg = await getFfmpeg((ratio) => {
    onProgress({
      label: 'Encoding video locally…',
      percent: Math.min(92, 20 + Math.round(ratio * 70)),
    });
  });

  onProgress({ label: 'Writing video to memory…', percent: 14 });
  await writeInputFile(ffmpeg, inputName, file);

  onProgress({ label: 'Processing video…', percent: 18 });
  const exit = await ffmpeg.exec(buildArgs(inputName));
  if (exit !== 0) {
    await cleanupFiles(ffmpeg, [inputName, outputName]);
    throw new Error('Could not process this video. Try a shorter clip or different format.');
  }

  onProgress({ label: 'Preparing download…', percent: 96 });
  const bytes = await readOutputFile(ffmpeg, outputName);
  await cleanupFiles(ffmpeg, [inputName, outputName]);

  const filename = `${base}_${outputName}`;
  downloadVideoOutput(bytes, filename, mimeType);
  onProgress({ label: 'Complete', percent: 100 });
  return { filename };
}

export async function extractMp3FromVideo(file: File, onProgress: ProgressFn): Promise<void> {
  await runJob(
    file,
    'audio.mp3',
    (input) => ['-i', input, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', 'audio.mp3'],
    onProgress,
    'audio/mpeg',
  );
}

export type CompressPreset = '720p' | '480p';

export async function compressVideo(
  file: File,
  preset: CompressPreset,
  onProgress: ProgressFn,
): Promise<void> {
  const height = preset === '720p' ? '720' : '480';
  const crf = preset === '720p' ? '28' : '30';
  await runJob(
    file,
    `compressed_${preset}.mp4`,
    (input) => [
      '-i',
      input,
      '-vf',
      `scale=-2:${height}`,
      '-c:v',
      'libx264',
      '-crf',
      crf,
      '-preset',
      'fast',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      `compressed_${preset}.mp4`,
    ],
    onProgress,
    'video/mp4',
  );
}

export type VideoOutputFormat = 'mp4' | 'webm' | 'mov';

export async function convertVideoFormat(
  file: File,
  format: VideoOutputFormat,
  onProgress: ProgressFn,
): Promise<void> {
  const outputName = `converted.${format}`;
  const mime =
    format === 'webm' ? 'video/webm' : format === 'mov' ? 'video/quicktime' : 'video/mp4';

  const buildArgs = (input: string): string[] => {
    if (format === 'webm') {
      return ['-i', input, '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis', outputName];
    }
    return ['-i', input, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', outputName];
  };

  await runJob(file, outputName, buildArgs, onProgress, mime);
}

export async function muteVideo(file: File, onProgress: ProgressFn): Promise<void> {
  await runJob(
    file,
    'muted.mp4',
    (input) => ['-i', input, '-c:v', 'copy', '-an', 'muted.mp4'],
    onProgress,
    'video/mp4',
  );
}

export interface GifOptions {
  startSec: number;
  durationSec: number;
  fps: number;
  width: number;
}

export async function videoToGif(file: File, options: GifOptions, onProgress: ProgressFn): Promise<void> {
  const { startSec, durationSec, fps, width } = options;
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;

  await runJob(
    file,
    'output.gif',
    (input) => [
      '-ss',
      String(Math.max(0, startSec)),
      '-t',
      String(Math.max(0.5, durationSec)),
      '-i',
      input,
      '-vf',
      filter,
      '-loop',
      '0',
      'output.gif',
    ],
    onProgress,
    'image/gif',
  );
}

export interface TrimOptions {
  startSec: number;
  endSec: number;
}

export async function trimVideo(
  file: File,
  options: TrimOptions,
  onProgress: ProgressFn,
): Promise<void> {
  const start = Math.max(0, options.startSec);
  const end = Math.max(start + 0.5, options.endSec);

  await runJob(
    file,
    'trimmed.mp4',
    (input) => [
      '-ss',
      String(start),
      '-to',
      String(end),
      '-i',
      input,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      'trimmed.mp4',
    ],
    onProgress,
    'video/mp4',
  );
}

export type VideoSpeedPreset = 0.5 | 1.5 | 2;

export async function changeVideoSpeed(
  file: File,
  speed: VideoSpeedPreset,
  onProgress: ProgressFn,
): Promise<void> {
  const ptsFactor = 1 / speed;
  const outputName = `speed_${speed}x.mp4`;

  await runJob(
    file,
    outputName,
    (input) => [
      '-i',
      input,
      '-filter:v',
      `setpts=${ptsFactor}*PTS`,
      '-filter:a',
      `atempo=${speed}`,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      outputName,
    ],
    onProgress,
    'video/mp4',
  );
}

function escapeDrawtext(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '\\%');
}

export async function watermarkVideo(
  file: File,
  text: string,
  onProgress: ProgressFn,
): Promise<void> {
  const label = escapeDrawtext(text.trim() || 'Watermark');
  const filter = `drawtext=text='${label}':fontsize=28:fontcolor=white@0.55:x=(w-text_w-24):y=(h-th-24):shadowcolor=black@0.4:shadowx=1:shadowy=1`;

  await runJob(
    file,
    'watermarked.mp4',
    (input) => ['-i', input, '-vf', filter, '-c:a', 'copy', 'watermarked.mp4'],
    onProgress,
    'video/mp4',
  );
}
