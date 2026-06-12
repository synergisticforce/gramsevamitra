export type MarginField = 'cost' | 'revenue' | 'grossProfit' | 'markupPct' | 'marginPct';

export interface MarginModel {
  cost: number | null;
  revenue: number | null;
  grossProfit: number | null;
  markupPct: number | null;
  marginPct: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function deriveAll(cost: number, revenue: number): MarginModel {
  const grossProfit = revenue - cost;
  const markupPct = cost !== 0 ? (grossProfit / cost) * 100 : null;
  const marginPct = revenue !== 0 ? (grossProfit / revenue) * 100 : null;
  return {
    cost: round2(cost),
    revenue: round2(revenue),
    grossProfit: round2(grossProfit),
    markupPct: markupPct !== null ? round2(markupPct) : null,
    marginPct: marginPct !== null ? round2(marginPct) : null,
  };
}

function has(f1: MarginField, f2: MarginField, a: MarginField, b: MarginField): boolean {
  return (f1 === a && f2 === b) || (f1 === b && f2 === a);
}

function val(f: MarginField, target: MarginField, v1: number, f1: MarginField, v2: number): number {
  return f1 === target ? v1 : v2;
}

function solvePair(f1: MarginField, v1: number, f2: MarginField, v2: number): MarginModel | null {
  if (!Number.isFinite(v1) || !Number.isFinite(v2)) return null;

  if (has(f1, f2, 'cost', 'revenue')) {
    return deriveAll(val('cost', 'cost', v1, f1, v2), val('revenue', 'revenue', v1, f1, v2));
  }
  if (has(f1, f2, 'cost', 'grossProfit')) {
    const cost = val('cost', 'cost', v1, f1, v2);
    const profit = val('grossProfit', 'grossProfit', v1, f1, v2);
    return deriveAll(cost, cost + profit);
  }
  if (has(f1, f2, 'revenue', 'grossProfit')) {
    const revenue = val('revenue', 'revenue', v1, f1, v2);
    const profit = val('grossProfit', 'grossProfit', v1, f1, v2);
    return deriveAll(revenue - profit, revenue);
  }
  if (has(f1, f2, 'cost', 'marginPct')) {
    const cost = val('cost', 'cost', v1, f1, v2);
    const margin = val('marginPct', 'marginPct', v1, f1, v2);
    if (margin >= 100) return null;
    return deriveAll(cost, cost / (1 - margin / 100));
  }
  if (has(f1, f2, 'cost', 'markupPct')) {
    const cost = val('cost', 'cost', v1, f1, v2);
    const markup = val('markupPct', 'markupPct', v1, f1, v2);
    return deriveAll(cost, cost * (1 + markup / 100));
  }
  if (has(f1, f2, 'revenue', 'marginPct')) {
    const revenue = val('revenue', 'revenue', v1, f1, v2);
    const margin = val('marginPct', 'marginPct', v1, f1, v2);
    const profit = revenue * (margin / 100);
    return deriveAll(revenue - profit, revenue);
  }
  if (has(f1, f2, 'revenue', 'markupPct')) {
    const revenue = val('revenue', 'revenue', v1, f1, v2);
    const markup = val('markupPct', 'markupPct', v1, f1, v2);
    const cost = revenue / (1 + markup / 100);
    return deriveAll(cost, revenue);
  }
  if (has(f1, f2, 'grossProfit', 'marginPct')) {
    const profit = val('grossProfit', 'grossProfit', v1, f1, v2);
    const margin = val('marginPct', 'marginPct', v1, f1, v2);
    if (margin === 0) return null;
    const revenue = profit / (margin / 100);
    return deriveAll(revenue - profit, revenue);
  }
  if (has(f1, f2, 'grossProfit', 'markupPct')) {
    const profit = val('grossProfit', 'grossProfit', v1, f1, v2);
    const markup = val('markupPct', 'markupPct', v1, f1, v2);
    if (markup === 0) return null;
    const cost = profit / (markup / 100);
    return deriveAll(cost, cost + profit);
  }

  return null;
}

/** Resolve margin matrix from the two most recently edited fields. */
export function resolveMarginModel(
  values: MarginModel,
  edited: MarginField,
  anchor: MarginField | null,
): MarginModel {
  const editedVal = values[edited];
  if (editedVal === null) return values;

  if (anchor && anchor !== edited && values[anchor] !== null) {
    const solved = solvePair(edited, editedVal, anchor, values[anchor]!);
    if (solved) return solved;
  }

  const fields: MarginField[] = ['cost', 'revenue', 'grossProfit', 'markupPct', 'marginPct'];
  for (const other of fields) {
    if (other === edited) continue;
    const otherVal = values[other];
    if (otherVal !== null) {
      const solved = solvePair(edited, editedVal, other, otherVal);
      if (solved) return solved;
    }
  }

  return { ...values, [edited]: editedVal };
}

export function parseMarginInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
