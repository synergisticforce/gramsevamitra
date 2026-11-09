export function computeHeaderSignatureHash(headers: string[]): Promise<string>;
export function mapUnfamiliarSpreadsheetHeaders(
  headers: string[],
  sampleRows?: unknown[][],
  options?: { sql?: { query: (text: string, values?: unknown[]) => Promise<Array<Record<string, unknown>>> }; geminiKey?: string },
): Promise<{ mapping: Record<string, string>; headerHash: string; cacheHit: boolean }>;
