export function toMinorUnits(value: unknown, scale?: number): number;
export function formatMinorUnits(
  amountMinor: number,
  symbol?: string,
  scale?: number,
  useIndicDigits?: boolean,
): string;
export function applyBps(amountMinor: number, bps: number): number;
export function unlockSplit(recoverableMinor: number): {
  recoverableMinor: number;
  userShareMinor: number;
  feeMinor: number;
};
