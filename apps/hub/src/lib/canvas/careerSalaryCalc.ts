/** Client-side Indian salary / take-home calculator for Career Prep. */

export type TaxRegime = 'new' | 'old';

export interface SalaryCalcInput {
  annualCtc: number;
  basicPercent: number;
  pfEnabled: boolean;
  professionalTaxMonthly: number;
  includeTaxEstimate: boolean;
  taxRegime: TaxRegime;
}

export interface SalaryBreakdown {
  annualCtc: number;
  basicAnnual: number;
  basicMonthly: number;
  grossAnnual: number;
  grossMonthly: number;
  employerPfAnnual: number;
  gratuityAnnual: number;
  employeePfMonthly: number;
  professionalTaxMonthly: number;
  estimatedTaxMonthly: number;
  totalDeductionsMonthly: number;
  inHandMonthly: number;
  inHandAnnual: number;
}

const STANDARD_DEDUCTION_NEW = 75_000;
const STANDARD_DEDUCTION_OLD = 50_000;
const PF_WAGE_CEILING_MONTHLY = 15_000;
const PF_RATE = 0.12;
const GRATUITY_RATE = 0.0481;

function clampPositive(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 0) return fallback;
  return value;
}

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

export function computeSalaryBreakdown(raw: Partial<SalaryCalcInput>): SalaryBreakdown {
  const annualCtc = clampPositive(raw.annualCtc ?? 0, 0);
  const basicPercent = clampPositive(raw.basicPercent ?? 40, 40);
  const pfEnabled = raw.pfEnabled ?? true;
  const professionalTaxMonthly = clampPositive(raw.professionalTaxMonthly ?? 200, 200);
  const includeTaxEstimate = raw.includeTaxEstimate ?? true;
  const taxRegime = raw.taxRegime ?? 'new';

  const basicAnnual = annualCtc * (basicPercent / 100);
  const basicMonthly = basicAnnual / 12;

  const pfBaseMonthly = Math.min(basicMonthly, PF_WAGE_CEILING_MONTHLY);
  const employeePfMonthly = pfEnabled ? pfBaseMonthly * PF_RATE : 0;
  const employerPfAnnual = employeePfMonthly * 12;
  const gratuityAnnual = basicAnnual * GRATUITY_RATE;

  const grossAnnual = Math.max(0, annualCtc - employerPfAnnual - gratuityAnnual);
  const grossMonthly = grossAnnual / 12;

  const employeePfAnnual = employeePfMonthly * 12;
  const standardDeduction =
    taxRegime === 'new' ? STANDARD_DEDUCTION_NEW : STANDARD_DEDUCTION_OLD;
  const taxableIncome = includeTaxEstimate
    ? Math.max(0, grossAnnual - employeePfAnnual - standardDeduction)
    : 0;
  const estimatedTaxAnnual = includeTaxEstimate
    ? estimateAnnualTax(taxableIncome, taxRegime)
    : 0;
  const estimatedTaxMonthly = estimatedTaxAnnual / 12;

  const totalDeductionsMonthly =
    employeePfMonthly + professionalTaxMonthly + estimatedTaxMonthly;
  const inHandMonthly = Math.max(0, grossMonthly - totalDeductionsMonthly);

  return {
    annualCtc,
    basicAnnual,
    basicMonthly,
    grossAnnual,
    grossMonthly,
    employerPfAnnual,
    gratuityAnnual,
    employeePfMonthly,
    professionalTaxMonthly,
    estimatedTaxMonthly,
    totalDeductionsMonthly,
    inHandMonthly,
    inHandAnnual: inHandMonthly * 12,
  };
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatLpa(amount: number): string {
  if (amount >= 100_000) {
    return `₹${(amount / 100_000).toFixed(2)} LPA`;
  }
  return formatInr(amount);
}
