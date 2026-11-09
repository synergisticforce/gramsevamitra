import { runEcommerceAudit as runEcommerceAuditJs } from '../../../../../functions/_lib/ecommerceAuditor.mjs';

export interface EcommerceAuditResult {
  findings: Array<Record<string, unknown>>;
  reconciledNetPayoutPaise: number;
}

export function runEcommerceAudit(
  statement: Record<string, unknown>,
  contract: Record<string, unknown>,
  options?: Record<string, unknown>,
): EcommerceAuditResult {
  return runEcommerceAuditJs(statement, contract, options) as EcommerceAuditResult;
}
