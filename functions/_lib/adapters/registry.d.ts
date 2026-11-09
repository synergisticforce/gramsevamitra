export function detectAndParseWorkbook(input: unknown, filename?: string): Promise<Record<string, unknown>>;
export function auditUploadedWorkbook(
  input: unknown,
  filename?: string,
  contractOverrides?: Record<string, unknown>,
  options?: Record<string, unknown>,
): Promise<{
  statement: Record<string, unknown>;
  auditResult: {
    findings: Array<Record<string, unknown>>;
    reconciledNetPayoutPaise: number;
    statutoryTaxSummary?: Record<string, number>;
    newCarryForwardEntries?: Array<Record<string, unknown>>;
  };
  taxPackage: Record<string, number | string>;
}>;
