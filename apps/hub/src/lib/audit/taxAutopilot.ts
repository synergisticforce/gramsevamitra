import { buildTaxAutopilotPackage as buildTaxAutopilotPackageJs } from '../../../../../functions/_lib/taxAutopilot.mjs';

export interface TaxAutopilotPackage {
  grossSalesPaise: number;
  totalPlatformFeesPaise: number;
  gstr2bInputTaxCredit18PctPaise: number;
  form26asTds194OPaise: number;
  gstr8TcsSec52Paise: number;
  section95PassThroughGstPaise: number;
  tallyJournalCsv: string;
  tallyVoucherXml: string;
}

export function buildTaxAutopilotPackage(
  statement: Record<string, unknown>,
  auditResult?: Record<string, unknown>,
): TaxAutopilotPackage {
  return buildTaxAutopilotPackageJs(statement, auditResult) as TaxAutopilotPackage;
}
