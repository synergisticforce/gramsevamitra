/** Video workspace tool registry (Phase 6 — client-only local processing). */

export type VideoToolCategory = 'extract' | 'transform' | 'convert';

export type VideoToolId =
  | 'mp4-to-mp3'
  | 'video-compressor'
  | 'format-converter'
  | 'mute-video'
  | 'video-to-gif';

export interface VideoCanvasTool {
  id: VideoToolId;
  label: string;
  icon: string;
  category: VideoToolCategory;
  description: string;
}

export const VIDEO_CATEGORY_META: Record<VideoToolCategory, { label: string; description: string }> = {
  extract: {
    label: 'Extract',
    description: 'Pull audio tracks from video files without uploading to a server.',
  },
  transform: {
    label: 'Transform',
    description: 'Compress, mute, or turn clips into GIFs — all in-browser.',
  },
  convert: {
    label: 'Convert',
    description: 'Switch between MP4, WebM, and MOV on your device.',
  },
};

export const VIDEO_CANVAS_TOOLS: VideoCanvasTool[] = [
  {
    id: 'mp4-to-mp3',
    label: 'MP4 to MP3',
    icon: '🎵',
    category: 'extract',
    description: 'Strip and export the audio track as a high-quality MP3 file.',
  },
  {
    id: 'video-compressor',
    label: 'Video Compressor',
    icon: '📦',
    category: 'transform',
    description: 'Reduce resolution to 720p or 480p and shrink file size with H.264.',
  },
  {
    id: 'format-converter',
    label: 'Format Converter',
    icon: '🔁',
    category: 'convert',
    description: 'Convert between MP4, WebM, and MOV — processed privately on your device.',
  },
  {
    id: 'mute-video',
    label: 'Mute Video',
    icon: '🔇',
    category: 'transform',
    description: 'Remove the audio track while keeping the video stream intact.',
  },
  {
    id: 'video-to-gif',
    label: 'Video to GIF',
    icon: '✨',
    category: 'transform',
    description: 'Trim a segment and export an animated GIF with palette optimization.',
  },
];

export function getVideoTool(id: VideoToolId): VideoCanvasTool | undefined {
  return VIDEO_CANVAS_TOOLS.find((tool) => tool.id === id);
}

export function videoToolsByCategory(): Record<VideoToolCategory, VideoCanvasTool[]> {
  const grouped: Record<VideoToolCategory, VideoCanvasTool[]> = {
    extract: [],
    transform: [],
    convert: [],
  };
  for (const tool of VIDEO_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export const VIDEO_TOOL_IDS: VideoToolId[] = VIDEO_CANVAS_TOOLS.map((t) => t.id);

export function isVideoToolId(value: string): value is VideoToolId {
  return VIDEO_TOOL_IDS.includes(value as VideoToolId);
}
