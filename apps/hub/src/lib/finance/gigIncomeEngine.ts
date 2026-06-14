/** Gig income tracker — entries and monthly totals. */

export interface GigIncomeEntry {
  id: string;
  date: string;
  amount: number;
  client: string;
  category: string;
}

export function createGigEntryId(): string {
  return `gig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_GIG_ENTRIES: GigIncomeEntry[] = [
  {
    id: createGigEntryId(),
    date: new Date().toISOString().slice(0, 10),
    amount: 12_000,
    client: 'Local shop branding',
    category: 'Design',
  },
  {
    id: createGigEntryId(),
    date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    amount: 8_500,
    client: 'Website maintenance',
    category: 'Development',
  },
];

export function monthlyGigTotals(entries: GigIncomeEntry[]): { month: string; total: number }[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    if (entry.amount <= 0 || !entry.date) continue;
    const month = entry.date.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + entry.amount);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

export function totalGigIncome(entries: GigIncomeEntry[]): number {
  return entries.reduce((sum, e) => sum + Math.max(0, e.amount), 0);
}

export function gigByCategory(entries: GigIncomeEntry[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const cat = entry.category.trim() || 'Other';
    map.set(cat, (map.get(cat) ?? 0) + Math.max(0, entry.amount));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}
