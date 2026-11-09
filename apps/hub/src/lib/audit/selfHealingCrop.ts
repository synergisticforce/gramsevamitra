import {
  inspectAndQueueOcrDiscrepancies as inspectJs,
  resolveCellVerification as resolveJs,
} from '../../../../../functions/_lib/selfHealingCrop.mjs';

export interface CellVerificationQueueItem {
  orderId: string;
  sourceTabName: string;
  rowNumber: number;
  columnName: string;
  expectedPaise: number;
  extractedPaise: number;
  assignedToRole: 'MUNSHI' | 'ADMIN';
  status: string;
}

export function inspectAndQueueOcrDiscrepancies(
  statement: Record<string, unknown>,
  auditResult?: Record<string, unknown>,
  options?: { munshiId?: string | null; isOcr?: boolean },
): { queue: CellVerificationQueueItem[]; statement: Record<string, unknown> } {
  return inspectJs(statement, auditResult, options) as unknown as {
    queue: CellVerificationQueueItem[];
    statement: Record<string, unknown>;
  };
}

export function resolveCellVerification(
  statement: Record<string, unknown>,
  queueItem: CellVerificationQueueItem,
  correctedValueRupeesOrPaise: unknown,
  contract?: Record<string, unknown>,
  options?: Record<string, unknown>,
): {
  statement: Record<string, unknown>;
  queueItem: CellVerificationQueueItem;
  auditResult: Record<string, unknown> | null;
  horizontalGapPaise: number | null;
} {
  return resolveJs(
    statement,
    queueItem as unknown as Record<string, unknown>,
    correctedValueRupeesOrPaise,
    contract,
    options,
  ) as unknown as {
    statement: Record<string, unknown>;
    queueItem: CellVerificationQueueItem;
    auditResult: Record<string, unknown> | null;
    horizontalGapPaise: number | null;
  };
}
