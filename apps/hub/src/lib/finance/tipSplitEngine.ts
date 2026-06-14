export interface TipSplitResult {
  billAmount: number;
  tipPercent: number;
  tipAmount: number;
  totalWithTip: number;
  numPeople: number;
  perPerson: number;
}

export function calculateTipSplit(
  billAmount: number,
  tipPercent: number,
  numPeople: number
): TipSplitResult | null {
  if (billAmount <= 0 || numPeople <= 0) return null;
  const tipAmount = billAmount * (Math.max(0, tipPercent) / 100);
  const totalWithTip = billAmount + tipAmount;
  return {
    billAmount,
    tipPercent,
    tipAmount,
    totalWithTip,
    numPeople,
    perPerson: totalWithTip / numPeople,
  };
}
