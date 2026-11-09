export function chunkPdfMax10Pages(pdfBytes: Uint8Array | ArrayBuffer): Promise<Uint8Array[]>;
export function slicePdfMax2Pages(pdfBytes: Uint8Array | ArrayBuffer, startPageIndex?: number): Promise<Uint8Array>;
export function rowsFromTextItems(items: Array<{ str: string; transform: number[] }>): string[][];
export function extractDigitalPdfRowsOrEscalate(
  pdfBytes: Uint8Array | ArrayBuffer,
): Promise<{ mode: 'NEEDS_OCR'; reason: string } | { mode: 'DIGITAL_EXTRACTED'; rows: string[][] }>;
export function hasCorruptedLegacyIndicFont(text: string): boolean;
