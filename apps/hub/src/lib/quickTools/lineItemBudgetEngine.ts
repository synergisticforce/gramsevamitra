/** Line-item budget calculator — materials, labor, and totals. */

export type BudgetLineCategory = 'materials' | 'labor' | 'other';

export interface BudgetLineItem {
  id: string;
  name: string;
  quantity: number;
  unitCost: number;
  category: BudgetLineCategory;
}

export function createBudgetLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function lineItemTotal(item: BudgetLineItem): number {
  return Math.max(0, item.quantity) * Math.max(0, item.unitCost);
}

export function summarizeBudget(items: BudgetLineItem[]): {
  total: number;
  materials: number;
  labor: number;
  other: number;
} {
  let materials = 0;
  let labor = 0;
  let other = 0;
  for (const item of items) {
    const amount = lineItemTotal(item);
    if (item.category === 'materials') materials += amount;
    else if (item.category === 'labor') labor += amount;
    else other += amount;
  }
  return { total: materials + labor + other, materials, labor, other };
}

export const BUDGET_CATEGORY_LABELS: Record<BudgetLineCategory, string> = {
  materials: 'Materials',
  labor: 'Labor',
  other: 'Other',
};
