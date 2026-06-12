export const GST_SLABS = [5, 12, 18, 28] as const;

export type GstMode = 'inclusive' | 'exclusive';
export type GstSupplyType = 'intrastate' | 'interstate';

export interface GstResult {
  net: number;
  cgst: number;
  sgst: number;
  igst: number;
  gstTotal: number;
  gross: number;
  rate: number;
  mode: GstMode;
  supplyType: GstSupplyType;
}

export function calculateGst(
  amount: number,
  ratePct: number,
  mode: GstMode,
  supplyType: GstSupplyType = 'intrastate',
): GstResult | null {
  if (amount <= 0 || ratePct < 0 || ratePct > 100) return null;

  let net: number;
  let gross: number;
  let gstTotal: number;

  if (mode === 'exclusive') {
    net = amount;
    gstTotal = (net * ratePct) / 100;
    gross = net + gstTotal;
  } else {
    gross = amount;
    net = gross / (1 + ratePct / 100);
    gstTotal = gross - net;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (supplyType === 'interstate') {
    igst = gstTotal;
  } else {
    cgst = gstTotal / 2;
    sgst = gstTotal / 2;
  }

  return {
    net,
    cgst,
    sgst,
    igst,
    gstTotal,
    gross,
    rate: ratePct,
    mode,
    supplyType,
  };
}
