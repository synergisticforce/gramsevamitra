export const EVIDENCE_PACK_SHEETS: string[];
export function buildEvidencePackWorkbook(
  statement: Record<string, unknown>,
  auditResult: Record<string, unknown>,
  taxPackage?: Record<string, unknown>,
): { workbook: unknown; bytes: Uint8Array };
