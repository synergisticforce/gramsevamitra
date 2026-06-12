export interface Ingredient {
  name: string;
  qty: number;
  unit: string;
  raw: string;
}

export interface ScaledIngredient extends Ingredient {
  scaledQty: number;
  scaledLabel: string;
}

const NUM_RE = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(.*)$/;

export function parseFraction(s: string): number {
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : Number(s);
  }
  return parseFloat(s);
}

export function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const frac = n % 1;
  if (Math.abs(frac - 0.5) < 0.01) return `${Math.floor(n) || ''}½`.replace(/^½$/, '½');
  if (Math.abs(frac - 0.25) < 0.01) return `${Math.floor(n) || ''}¼`.replace(/^¼$/, '¼');
  if (Math.abs(frac - 0.75) < 0.01) return `${Math.floor(n) || ''}¾`.replace(/^¾$/, '¾');
  if (Math.abs(frac - 0.333) < 0.02) return `${Math.floor(n) || ''}⅓`.replace(/^⅓$/, '⅓');
  if (Math.abs(frac - 0.667) < 0.02) return `${Math.floor(n) || ''}⅔`.replace(/^⅔$/, '⅔');
  return n.toFixed(2).replace(/\.?0+$/, '');
}

export function parseIngredientLine(line: string): Ingredient | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const candidate = parts.slice(i).join(' ');
    const m = candidate.match(NUM_RE);
    if (m) {
      const name = parts.slice(0, i).join(' ') || trimmed;
      return {
        name: name.trim() || trimmed,
        qty: parseFraction(m[1]),
        unit: m[2].trim(),
        raw: trimmed,
      };
    }
  }
  return { name: trimmed, qty: 1, unit: '', raw: trimmed };
}

export function scaleRecipe(
  lines: string,
  originalServings: number,
  targetServings: number,
): { factor: number; items: ScaledIngredient[] } {
  const original = Math.max(0.25, originalServings);
  const target = Math.max(0.25, targetServings);
  const factor = target / original;

  const items = lines
    .split('\n')
    .map(parseIngredientLine)
    .filter((item): item is Ingredient => item !== null)
    .map((item) => {
      const scaledQty = item.qty * factor;
      const scaledLabel = `${formatQty(scaledQty)}${item.unit ? ` ${item.unit}` : ''}`.trim();
      return { ...item, scaledQty, scaledLabel };
    });

  return { factor, items };
}
