import { clamp } from './formatInr';

export interface DiscountResult {
  originalPrice: number;
  discountPercent: number;
  flatDiscount: number;
  discountAmount: number;
  priceAfterDiscount: number;
  taxAmount: number;
  finalPrice: number;
  savingsPercent: number;
}

export function calculateDiscount(
  originalPrice: number,
  discountPercent: number,
  flatDiscount: number,
  taxPercent: number
): DiscountResult | null {
  if (originalPrice <= 0) return null;

  const pct = clamp(discountPercent, 0, 100);
  const flat = Math.max(0, flatDiscount);
  const pctAmount = originalPrice * (pct / 100);
  const discountAmount = Math.min(originalPrice, pctAmount + flat);
  const priceAfterDiscount = Math.max(0, originalPrice - discountAmount);
  const taxAmount = priceAfterDiscount * (Math.max(0, taxPercent) / 100);
  const finalPrice = priceAfterDiscount + taxAmount;
  const savingsPercent = originalPrice > 0 ? (discountAmount / originalPrice) * 100 : 0;

  return {
    originalPrice,
    discountPercent: pct,
    flatDiscount: flat,
    discountAmount,
    priceAfterDiscount,
    taxAmount,
    finalPrice,
    savingsPercent,
  };
}
