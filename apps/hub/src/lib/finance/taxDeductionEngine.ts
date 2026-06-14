export type TaxRegime = 'new' | 'old';

export interface DeductionCategory {
  id: string;
  label: string;
  hint: string;
  maxDeduction: number | null;
}

export const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  {
    id: '80c',
    label: 'Section 80C',
    hint: 'PPF, ELSS, life insurance, tuition fees',
    maxDeduction: 150_000,
  },
  {
    id: '80d',
    label: 'Section 80D',
    hint: 'Health insurance premiums',
    maxDeduction: 25_000,
  },
  {
    id: '80ccd',
    label: 'NPS (80CCD(1B))',
    hint: 'Additional NPS contribution',
    maxDeduction: 50_000,
  },
  {
    id: 'hra',
    label: 'HRA exemption',
    hint: 'House rent allowance (old regime)',
    maxDeduction: null,
  },
  {
    id: 'home-loan',
    label: 'Home loan interest (24b)',
    hint: 'Interest on self-occupied property',
    maxDeduction: 200_000,
  },
  {
    id: 'other',
    label: 'Other deductions',
    hint: 'Education loan, donations, etc.',
    maxDeduction: null,
  },
];

const STANDARD_DEDUCTION: Record<TaxRegime, number> = {
  new: 75_000,
  old: 50_000,
};

function estimateAnnualTax(taxableIncome: number, regime: TaxRegime): number {
  if (taxableIncome <= 0) return 0;

  if (regime === 'new') {
    let tax = 0;
    let remaining = taxableIncome;
    const slabs: [number, number][] = [
      [400_000, 0],
      [400_000, 0.05],
      [400_000, 0.1],
      [400_000, 0.15],
      [400_000, 0.2],
      [Infinity, 0.3],
    ];
    for (const [limit, rate] of slabs) {
      const slice = Math.min(remaining, limit);
      tax += slice * rate;
      remaining -= slice;
      if (remaining <= 0) break;
    }
    return tax * 1.04;
  }

  let tax = 0;
  let remaining = taxableIncome;
  const slabs: [number, number][] = [
    [250_000, 0],
    [250_000, 0.05],
    [500_000, 0.2],
    [Infinity, 0.3],
  ];
  for (const [limit, rate] of slabs) {
    const slice = Math.min(remaining, limit);
    tax += slice * rate;
    remaining -= slice;
    if (remaining <= 0) break;
  }
  return tax * 1.04;
}

function capDeduction(categoryId: string, amount: number, regime: TaxRegime): number {
  if (amount <= 0) return 0;
  if (categoryId === 'hra' && regime === 'new') return 0;
  const cat = DEDUCTION_CATEGORIES.find((c) => c.id === categoryId);
  if (!cat?.maxDeduction) return amount;
  return Math.min(amount, cat.maxDeduction);
}

export interface TaxDeductionResult {
  grossIncome: number;
  totalDeductions: number;
  taxableWithoutExtras: number;
  taxableWithExtras: number;
  taxWithoutExtras: number;
  taxWithExtras: number;
  estimatedSavings: number;
  byCategory: { id: string; label: string; applied: number }[];
}

export function estimateTaxDeductions(
  grossIncome: number,
  deductions: Record<string, number>,
  regime: TaxRegime
): TaxDeductionResult {
  const byCategory = DEDUCTION_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: cat.label,
    applied: capDeduction(cat.id, deductions[cat.id] ?? 0, regime),
  }));

  const totalDeductions = byCategory.reduce((sum, row) => sum + row.applied, 0);
  const standard = STANDARD_DEDUCTION[regime];

  const taxableWithoutExtras = Math.max(0, grossIncome - standard);
  const taxableWithExtras = Math.max(0, grossIncome - standard - totalDeductions);

  const taxWithoutExtras = estimateAnnualTax(taxableWithoutExtras, regime);
  const taxWithExtras = estimateAnnualTax(taxableWithExtras, regime);

  return {
    grossIncome,
    totalDeductions,
    taxableWithoutExtras,
    taxableWithExtras,
    taxWithoutExtras,
    taxWithExtras,
    estimatedSavings: Math.max(0, taxWithoutExtras - taxWithExtras),
    byCategory,
  };
}
