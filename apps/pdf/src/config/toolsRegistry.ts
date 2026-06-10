export type ToolCategory = 'popular' | 'compress' | 'edit' | 'convert';

export type ToolId =
  | 'compress-kb'
  | 'repair-pdf'
  | 'deskew-pdf'
  | 'repair-meta'
  | 'merge-pdf'
  | 'split-pdf'
  | 'remove-pages'
  | 'rotate-pdf'
  | 'reorder-pages'
  | 'add-page-numbers'
  | 'watermark-pdf'
  | 'jpg-to-pdf'
  | 'png-to-pdf'
  | 'word-to-pdf'
  | 'heic-to-pdf'
  | 'text-to-pdf'
  | 'pdf-to-jpg'
  | 'pdf-to-png'
  | 'pdf-to-text'
  | 'pdf-to-word'
  | 'organize-pdf'
  | 'sign-pdf'
  | 'crop-pdf'
  | 'unlock-pdf'
  | 'protect-pdf';

export interface ToolEntry {
  id: ToolId;
  name: string;
  description: string;
  keywords: string[];
  /** Alternate names users may search (e.g. "shrink" → Compress PDF Size). */
  aliases?: string[];
  category: ToolCategory;
  isFree: true;
  icon: string;
}

export const TOOLS_REGISTRY: ToolEntry[] = [
  {
    id: 'compress-kb',
    name: 'Compress PDF Size',
    description: 'Shrink PDFs for exam form uploads with premium quality presets — extreme, balanced, or high fidelity.',
    keywords: ['chota karna', 'compress', 'size', 'kb', 'reduce', 'light', 'kam MB', 'form upload'],
    aliases: ['shrink', 'smaller', 'reduce size', 'compress pdf', 'pdf compress'],
    category: 'popular',
    isFree: true,
    icon: '🗜️',
  },
  {
    id: 'repair-pdf',
    name: 'Repair Corrupt PDF',
    description: 'Rebuild broken or unreadable PDFs by reconstructing pages locally — no upload required.',
    keywords: ['repair', 'fix', 'corrupt', 'broken', 'theek karna', 'open nahi ho raha'],
    category: 'compress',
    isFree: true,
    icon: '🔧',
  },
  {
    id: 'deskew-pdf',
    name: 'Straighten / Deskew Pages',
    description: 'Fix tilted scans and crooked camera shots by rotating pages before you upload.',
    keywords: ['rotate', 'straighten', 'deskew', 'seedha', 'tilt', 'angle', 'skew'],
    category: 'compress',
    isFree: true,
    icon: '📐',
  },
  {
    id: 'repair-meta',
    name: 'Strip PDF Metadata',
    description: 'Remove hidden author, title, and metadata fields for cleaner, lighter exam submissions.',
    keywords: ['metadata', 'properties', 'clean', 'privacy', 'hidden info', 'details hatao'],
    category: 'compress',
    isFree: true,
    icon: '🧹',
  },
  {
    id: 'merge-pdf',
    name: 'Merge Multiple PDFs',
    description: 'Drag, reorder, and combine certificates and marksheets into one submission-ready file.',
    keywords: ['jodna', 'merge', 'combine', 'join', 'ek file', 'mila dena', 'multiple'],
    category: 'popular',
    isFree: true,
    icon: '📎',
  },
  {
    id: 'split-pdf',
    name: 'Split & Extract Pages',
    description: 'Tap page thumbnails to visually select and extract exactly the pages you need.',
    keywords: ['alag karna', 'split', 'extract', 'page', 'todna', 'nikalna', 'select pages'],
    category: 'popular',
    isFree: true,
    icon: '✂️',
  },
  {
    id: 'remove-pages',
    name: 'Remove PDF Pages',
    description: 'Delete unwanted blank or duplicate pages from a PDF before uploading.',
    keywords: ['delete', 'remove', 'hatao', 'extra page', 'blank page', 'clean up'],
    category: 'edit',
    isFree: true,
    icon: '🗑️',
  },
  {
    id: 'rotate-pdf',
    name: 'Rotate All Pages',
    description: 'Rotate every page 90°, 180°, or 270° when scans came in sideways.',
    keywords: ['rotate', 'ghumana', 'sideways', 'landscape', 'portrait', 'orientation'],
    category: 'edit',
    isFree: true,
    icon: '🔄',
  },
  {
    id: 'reorder-pages',
    name: 'Reorder PDF Pages',
    description: 'Change page sequence when certificates or annexures are in the wrong order.',
    keywords: ['reorder', 'sequence', 'order change', 'kram', 'arrange pages'],
    category: 'edit',
    isFree: true,
    icon: '🔀',
  },
  {
    id: 'add-page-numbers',
    name: 'Add Page Numbers',
    description: 'Stamp clean page numbers on every sheet for organized exam document bundles.',
    keywords: ['page number', 'numbering', 'count', 'ank', 'footer number'],
    category: 'edit',
    isFree: true,
    icon: '🔢',
  },
  {
    id: 'watermark-pdf',
    name: 'Add Watermark',
    description: 'Overlay a subtle draft or personal watermark across all pages for identification.',
    keywords: ['watermark', 'stamp', 'draft', 'mark', 'naam likho', 'label'],
    category: 'edit',
    isFree: true,
    icon: '💧',
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description: 'Convert phone photos and JPEG scans into a single PDF instantly in your browser.',
    keywords: ['jpg', 'jpeg', 'photo', 'tasveer', 'image to pdf', 'camera'],
    category: 'popular',
    isFree: true,
    icon: '🖼️',
  },
  {
    id: 'png-to-pdf',
    name: 'PNG to PDF',
    description: 'Turn transparent PNG screenshots and scans into a crisp PDF document.',
    keywords: ['png', 'screenshot', 'transparent', 'image to pdf'],
    category: 'convert',
    isFree: true,
    icon: '🖼️',
  },
  {
    id: 'word-to-pdf',
    name: 'Text / Word to PDF',
    description: 'Convert plain text or .txt documents into a formatted PDF for online forms.',
    keywords: ['word', 'doc', 'txt', 'text file', 'document convert', 'likhai pdf'],
    category: 'convert',
    isFree: true,
    icon: '📄',
  },
  {
    id: 'heic-to-pdf',
    name: 'HEIC / iPhone to PDF',
    description: 'Convert iPhone HEIC photos to PDF when portals reject Apple photo formats.',
    keywords: ['heic', 'iphone', 'ios photo', 'apple', 'heif', 'photo convert'],
    category: 'convert',
    isFree: true,
    icon: '📱',
  },
  {
    id: 'text-to-pdf',
    name: 'Type & Save as PDF',
    description: 'Type or paste notes directly and export as a clean PDF — great for declarations.',
    keywords: ['type', 'paste', 'write', 'declaration', 'notes', 'likho pdf'],
    category: 'convert',
    isFree: true,
    icon: '✍️',
  },
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    description: 'Export each PDF page as a JPG when the portal only accepts image uploads.',
    keywords: ['pdf to jpg', 'pdf to photo', 'jpeg export', 'image download'],
    category: 'convert',
    isFree: true,
    icon: '📸',
  },
  {
    id: 'pdf-to-png',
    name: 'PDF to PNG',
    description: 'Export sharp PNG images from every PDF page with lossless clarity.',
    keywords: ['pdf to png', 'screenshot', 'lossless', 'image export'],
    category: 'convert',
    isFree: true,
    icon: '🖼️',
  },
  {
    id: 'pdf-to-text',
    name: 'PDF to Text',
    description: 'Extract readable text from PDFs locally for forms, notes, or keyword checks.',
    keywords: ['text', 'copy', 'extract', 'ocr', 'likhai', 'padhna', 'words'],
    category: 'convert',
    isFree: true,
    icon: '📝',
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word / Text File',
    description: 'Download extracted PDF text as an editable document file for quick edits.',
    keywords: ['pdf to word', 'doc', 'editable', 'text file', 'convert back'],
    category: 'convert',
    isFree: true,
    icon: '📃',
  },
  {
    id: 'organize-pdf',
    name: 'Organize PDF Pages',
    description: 'Reorder, rotate, and remove pages in one visual studio — the all-in-one organizer.',
    keywords: ['organize', 'reorder', 'rotate', 'remove', 'all in one', 'pages'],
    category: 'popular',
    isFree: true,
    icon: '🗂️',
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF (Self-Attestation)',
    description: 'Draw your signature and place it anywhere on the document for self-attestation.',
    keywords: ['sign', 'signature', 'self attestation', 'dastakhat', 'e-sign'],
    category: 'edit',
    isFree: true,
    icon: '✍️',
  },
  {
    id: 'crop-pdf',
    name: 'Crop PDF Page',
    description: 'Visually crop photos, signatures, or margins with a drag-resize bounding box.',
    keywords: ['crop', 'trim', 'cut', 'margin', 'photo crop', 'signature crop'],
    category: 'edit',
    isFree: true,
    icon: '✂️',
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description: 'Remove password protection from encrypted PDFs using the open password locally.',
    keywords: ['unlock', 'decrypt', 'password remove', 'encrypted', 'open pdf'],
    category: 'edit',
    isFree: true,
    icon: '🔓',
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description: 'Encrypt your PDF with user and owner passwords before sharing sensitive documents.',
    keywords: ['protect', 'encrypt', 'password lock', 'secure pdf', 'lock'],
    category: 'edit',
    isFree: true,
    icon: '🔒',
  },
];

export type IntentTabId = 'all' | 'popular' | 'compress' | 'edit' | 'convert';

export interface IntentTab {
  id: IntentTabId;
  label: string;
  categories: ToolCategory[] | null;
}

export const INTENT_TABS: IntentTab[] = [
  { id: 'all', label: 'All Utilities', categories: null },
  { id: 'popular', label: 'Most Popular', categories: ['popular'] },
  { id: 'compress', label: 'Compress & Fix', categories: ['compress'] },
  { id: 'edit', label: 'Edit & Organize', categories: ['edit'] },
  { id: 'convert', label: 'Convert Format', categories: ['convert'] },
];

export const TOOL_MAP = Object.fromEntries(
  TOOLS_REGISTRY.map((tool) => [tool.id, tool])
) as Record<ToolId, ToolEntry>;

export function isToolId(value: string): value is ToolId {
  return value in TOOL_MAP;
}
