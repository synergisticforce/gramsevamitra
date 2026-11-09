export function bouncerKeywordGate(sheetNames: string[], sampleHeaderOrText: string): boolean;
export function scrubCustomerPiiRow(rowObj: Record<string, unknown>): Record<string, unknown>;
export function isSummaryOrTotalRow(rowObj: Record<string, unknown>, primaryIdFieldNames: string[]): boolean;
export function findHeaderRowIndex(
  aoa: unknown[][],
  requiredAliases: Record<string, string[]>,
): { headerRowIndex: number; columns: Record<string, number> } | null;
export function hasCorruptedLegacyIndicFont(text: string): boolean;
