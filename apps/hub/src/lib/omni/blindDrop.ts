/** Client-side file category for the Omni-Router Intent Engine. */
export type OmniFileCategory =
  | 'pdf'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'archive'
  | 'text'
  | 'unsupported';

/** Metadata extracted locally on drop — zero network I/O. */
export interface BlindDropMetadata {
  file: File;
  name: string;
  sizeBytes: number;
  mimeType: string;
  extension: string;
  category: OmniFileCategory;
  supported: boolean;
}

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
};

const UNSUPPORTED_EXTENSIONS = new Set(['exe', 'dmg', 'pkg', 'msi', 'bat', 'sh', 'app', 'deb', 'rpm']);

function parseExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
}

function resolveMimeType(file: File, extension: string): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  return EXTENSION_MIME[extension] ?? '';
}

function resolveCategory(mimeType: string, extension: string): OmniFileCategory {
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('spreadsheet') ||
    mimeType === 'text/csv' ||
    extension === 'xls' ||
    extension === 'xlsx' ||
    extension === 'csv'
  ) {
    return 'spreadsheet';
  }
  if (mimeType.includes('presentation') || extension === 'ppt' || extension === 'pptx') return 'presentation';
  if (
    mimeType.includes('wordprocessing') ||
    mimeType === 'application/msword' ||
    mimeType === 'application/rtf' ||
    extension === 'doc' ||
    extension === 'docx' ||
    extension === 'rtf'
  ) {
    return 'document';
  }
  if (
    mimeType.startsWith('text/') ||
    extension === 'txt' ||
    extension === 'md'
  ) {
    return 'text';
  }
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    ['zip', 'rar', '7z'].includes(extension)
  ) {
    return 'archive';
  }
  return 'unsupported';
}

function isSupported(category: OmniFileCategory, extension: string): boolean {
  if (UNSUPPORTED_EXTENSIONS.has(extension)) return false;
  return category !== 'unsupported';
}

/**
 * Blind Drop — reads MIME type, size, and extension from the File API only.
 * No fetch(), no upload, no Workers.
 */
export function extractBlindDropMetadata(file: File): BlindDropMetadata {
  const extension = parseExtension(file.name);
  const mimeType = resolveMimeType(file, extension);
  const category = resolveCategory(mimeType, extension);
  const supported = isSupported(category, extension);

  return {
    file,
    name: file.name,
    sizeBytes: file.size,
    mimeType: mimeType || 'application/octet-stream',
    extension,
    category,
    supported,
  };
}

export function categoryLabel(category: OmniFileCategory): string {
  switch (category) {
    case 'pdf':
      return 'PDF document';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Word document';
    case 'spreadsheet':
      return 'Spreadsheet';
    case 'presentation':
      return 'Presentation';
    case 'archive':
      return 'Archive';
    case 'text':
      return 'Text file';
    default:
      return 'Unknown file';
  }
}
