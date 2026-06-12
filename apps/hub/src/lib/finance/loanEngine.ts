import { clamp } from './formatInr';

export interface EmiResult {
  emi: number;
  totalPayment: number;
  totalInterest: number;
  principal: number;
  principalPct: number;
  interestPct: number;
  tenureMonths: number;
}

export interface AmortizationRow {
  month: number;
  year: number;
  beginningBalance: number;
  scheduledPayment: number;
  prepayment: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}

export interface AnnualAmortizationRow {
  year: number;
  beginningBalance: number;
  scheduledPayment: number;
  prepayment: number;
  principalPaid: number;
  interestPaid: number;
  endingBalance: number;
}

export interface LoanPrepaymentOptions {
  extraMonthly: number;
  lumpSumAmount: number;
  lumpSumMonth: number;
}

export function tenureToMonths(value: number, unit: 'years' | 'months'): number {
  const months = unit === 'years' ? value * 12 : value;
  return Math.round(clamp(months, 1, 600));
}

/** E = P * r * (1 + r)^n / ((1 + r)^n - 1) */
export function calculateEmi(
  principal: number,
  annualRatePct: number,
  months: number,
): EmiResult | null {
  if (principal <= 0 || months <= 0 || annualRatePct < 0) return null;

  const P = principal;
  const n = months;
  let emi: number;

  if (annualRatePct === 0) {
    emi = P / n;
  } else {
    const r = annualRatePct / 12 / 100;
    const compound = Math.pow(1 + r, n);
    emi = (P * r * compound) / (compound - 1);
  }

  if (!Number.isFinite(emi) || emi <= 0) return null;

  const schedule = buildAmortizationSchedule(principal, annualRatePct, months, emi, {
    extraMonthly: 0,
    lumpSumAmount: 0,
    lumpSumMonth: 0,
  });

  const totalPayment = schedule.reduce((sum, row) => sum + row.scheduledPayment + row.prepayment, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interestPaid, 0);
  const principalPct = totalPayment > 0 ? (P / totalPayment) * 100 : 50;
  const interestPct = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 50;

  return {
    emi,
    totalPayment,
    totalInterest,
    principal: P,
    principalPct,
    interestPct,
    tenureMonths: schedule.length,
  };
}

export function buildAmortizationSchedule(
  principal: number,
  annualRatePct: number,
  months: number,
  emi: number,
  prepayment: LoanPrepaymentOptions,
): AmortizationRow[] {
  const rows: AmortizationRow[] = [];
  let balance = principal;
  const monthlyRate = annualRatePct / 12 / 100;
  const maxMonths = Math.min(months, 600);

  for (let month = 1; month <= maxMonths && balance > 0.005; month++) {
    const beginningBalance = balance;
    const interestPaid = annualRatePct === 0 ? 0 : balance * monthlyRate;
    const scheduledPayment = Math.min(emi, balance + interestPaid);

    let principalFromEmi = scheduledPayment - interestPaid;
    if (principalFromEmi < 0) principalFromEmi = 0;

    let prepay =
      prepayment.extraMonthly +
      (prepayment.lumpSumMonth === month ? prepayment.lumpSumAmount : 0);

    const remainingAfterEmi = Math.max(0, balance - principalFromEmi);
    prepay = Math.min(prepay, remainingAfterEmi);

    const principalPaid = principalFromEmi + prepay;
    balance = Math.max(0, balance - principalPaid);

    rows.push({
      month,
      year: Math.ceil(month / 12),
      beginningBalance,
      scheduledPayment,
      prepayment: prepay,
      principalPaid,
      interestPaid,
      endingBalance: balance,
    });
  }

  return rows;
}

export function aggregateAmortizationByYear(rows: AmortizationRow[]): AnnualAmortizationRow[] {
  const map = new Map<number, AnnualAmortizationRow>();

  for (const row of rows) {
    const existing = map.get(row.year);
    if (!existing) {
      map.set(row.year, {
        year: row.year,
        beginningBalance: row.beginningBalance,
        scheduledPayment: row.scheduledPayment,
        prepayment: row.prepayment,
        principalPaid: row.principalPaid,
        interestPaid: row.interestPaid,
        endingBalance: row.endingBalance,
      });
    } else {
      existing.scheduledPayment += row.scheduledPayment;
      existing.prepayment += row.prepayment;
      existing.principalPaid += row.principalPaid;
      existing.interestPaid += row.interestPaid;
      existing.endingBalance = row.endingBalance;
    }
  }

  return [...map.values()].sort((a, b) => a.year - b.year);
}

export function analyzeLoan(
  principal: number,
  annualRatePct: number,
  tenureValue: number,
  tenureUnit: 'years' | 'months',
  prepayment: LoanPrepaymentOptions,
): { result: EmiResult | null; schedule: AmortizationRow[] } {
  const months = tenureToMonths(tenureValue, tenureUnit);
  const baseEmi = calculateEmi(principal, annualRatePct, months);
  if (!baseEmi) return { result: null, schedule: [] };

  const schedule = buildAmortizationSchedule(
    principal,
    annualRatePct,
    months,
    baseEmi.emi,
    prepayment,
  );

  const totalPayment = schedule.reduce((sum, row) => sum + row.scheduledPayment + row.prepayment, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interestPaid, 0);
  const principalPct = totalPayment > 0 ? (principal / totalPayment) * 100 : 50;
  const interestPct = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 50;

  return {
    result: {
      emi: baseEmi.emi,
      totalPayment,
      totalInterest,
      principal,
      principalPct,
      interestPct,
      tenureMonths: schedule.length,
    },
    schedule,
  };
}
