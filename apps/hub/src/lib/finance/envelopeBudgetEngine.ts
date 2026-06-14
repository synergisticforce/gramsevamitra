/** Envelope budgeting — budget vs. actual per category. */

export interface EnvelopeCategory {
  id: string;
  name: string;
  budget: number;
  spent: number;
  color: string;
}

export const ENVELOPE_COLORS = ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b'];

export function createEnvelopeId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_ENVELOPES: EnvelopeCategory[] = [
  { id: createEnvelopeId(), name: 'Rent', budget: 15_000, spent: 15_000, color: ENVELOPE_COLORS[0] },
  { id: createEnvelopeId(), name: 'Groceries', budget: 8_000, spent: 5_200, color: ENVELOPE_COLORS[1] },
  { id: createEnvelopeId(), name: 'Transport', budget: 3_000, spent: 2_100, color: ENVELOPE_COLORS[2] },
  { id: createEnvelopeId(), name: 'Savings', budget: 10_000, spent: 10_000, color: ENVELOPE_COLORS[3] },
];

export function summarizeEnvelopes(envelopes: EnvelopeCategory[]): {
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  overBudgetCount: number;
} {
  const totalBudget = envelopes.reduce((sum, e) => sum + Math.max(0, e.budget), 0);
  const totalSpent = envelopes.reduce((sum, e) => sum + Math.max(0, e.spent), 0);
  const overBudgetCount = envelopes.filter((e) => e.spent > e.budget).length;
  return { totalBudget, totalSpent, remaining: totalBudget - totalSpent, overBudgetCount };
}
