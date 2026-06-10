const STRUCTURAL_ERROR_PATTERNS = [
  /offset is out of bounds/i,
  /cross[- ]?reference/i,
  /xref/i,
  /invalid object ref/i,
  /failed to parse/i,
  /corrupt/i,
  /unexpected token/i,
  /invalid pdf/i,
];

export function isPdfStructuralError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return STRUCTURAL_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export const EXTREME_FALLBACK_MESSAGE =
  'Extreme compression destabilized this file structure. Safely fell back to Recommended tier.';
