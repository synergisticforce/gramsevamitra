import { clamp } from './formatInr';

export type StepUpMode = 'percent' | 'amount';

export interface SipYearRow {
  year: number;
  invested: number;
  corpus: number;
  gains: number;
  realCorpus?: number;
}

export interface SipResult {
  totalInvested: number;
  totalValue: number;
  estimatedReturns: number;
  realTotalValue?: number;
  investedPct: number;
  gainsPct: number;
}

export interface SipParams {
  monthlyInvestment: number;
  annualReturnPct: number;
  years: number;
  stepUpMode: StepUpMode;
  stepUpValue: number;
  inflationAdjust: boolean;
  inflationPct?: number;
}

function monthlyContribution(
  base: number,
  year: number,
  stepUpMode: StepUpMode,
  stepUpValue: number,
): number {
  if (year <= 1) return base;
  const steps = year - 1;
  if (stepUpMode === 'percent') {
    return base * Math.pow(1 + stepUpValue / 100, steps);
  }
  return base + stepUpValue * steps;
}

export function projectSipMonthByMonth(params: SipParams): { result: SipResult | null; yearly: SipYearRow[] } {
  const {
    monthlyInvestment,
    annualReturnPct,
    years,
    stepUpMode,
    stepUpValue,
    inflationAdjust,
    inflationPct = 6,
  } = params;

  if (monthlyInvestment <= 0 || years <= 0 || annualReturnPct < 0) {
    return { result: null, yearly: [] };
  }

  const totalMonths = Math.round(clamp(years, 1, 40) * 12);
  const monthlyRate = annualReturnPct / 12 / 100;
  let balance = 0;
  let totalInvested = 0;
  const yearly: SipYearRow[] = [];

  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);
    const contribution = monthlyContribution(
      monthlyInvestment,
      year,
      stepUpMode,
      Math.max(0, stepUpValue),
    );
    balance += contribution;
    totalInvested += contribution;
    if (monthlyRate > 0) {
      balance *= 1 + monthlyRate;
    }

    if (month % 12 === 0 || month === totalMonths) {
      const gains = balance - totalInvested;
      const row: SipYearRow = {
        year,
        invested: Math.round(totalInvested),
        corpus: Math.round(balance),
        gains: Math.round(gains),
      };
      if (inflationAdjust) {
        row.realCorpus = Math.round(balance / Math.pow(1 + inflationPct / 100, year));
      }
      yearly.push(row);
    }
  }

  const estimatedReturns = balance - totalInvested;
  const totalValue = balance;
  const investedPct = totalValue > 0 ? (totalInvested / totalValue) * 100 : 50;
  const gainsPct = totalValue > 0 ? (estimatedReturns / totalValue) * 100 : 50;

  const result: SipResult = {
    totalInvested,
    totalValue,
    estimatedReturns,
    investedPct,
    gainsPct,
  };

  if (inflationAdjust) {
    result.realTotalValue = totalValue / Math.pow(1 + inflationPct / 100, years);
  }

  return { result, yearly };
}

/** Closed-form SIP for a fixed monthly amount (no step-up). */
export function calculateSipFixed(
  monthly: number,
  annualRatePct: number,
  years: number,
): SipResult | null {
  return projectSipMonthByMonth({
    monthlyInvestment: monthly,
    annualReturnPct: annualRatePct,
    years,
    stepUpMode: 'percent',
    stepUpValue: 0,
    inflationAdjust: false,
  }).result;
}
