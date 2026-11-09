export declare const EVIDENCE_PACK_SHEETS: readonly string[];
export function buildEvidencePackWorkbook(
  statement: Record<string, unknown>,
  auditResult: Record<string, unknown>,
  taxPackage?: Record<string, unknown>,
): { workbook: unknown; bytes: Uint8Array };
