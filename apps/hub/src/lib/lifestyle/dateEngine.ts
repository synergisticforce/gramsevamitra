export interface AgeBreakdown {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

export function parseDateInput(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function ageBetween(birth: Date, on: Date): AgeBreakdown {
  let years = on.getFullYear() - birth.getFullYear();
  let months = on.getMonth() - birth.getMonth();
  let days = on.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(on.getFullYear(), on.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = Math.floor((on.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000));
  return { years, months, days, totalDays: Math.max(0, totalDays) };
}

export function durationBetween(start: Date, end: Date): AgeBreakdown {
  if (end < start) return ageBetween(end, start);
  return ageBetween(start, end);
}

export function formatDateLong(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export interface ExamEligibilityResult {
  eligible: boolean;
  completedYears: number;
  earliestBirth: Date;
  latestBirth: Date;
  message: string;
}

/** Government-style age window: min/max completed years as on reference date. */
export function checkExamEligibility(
  dob: Date,
  reference: Date,
  minAge: number,
  maxAge: number,
): ExamEligibilityResult {
  const age = ageBetween(dob, reference);
  const completedYears = age.years;

  const latestBirth = new Date(reference);
  latestBirth.setFullYear(latestBirth.getFullYear() - minAge);

  const earliestBirth = new Date(reference);
  earliestBirth.setFullYear(earliestBirth.getFullYear() - maxAge);

  const eligible = dob >= earliestBirth && dob <= latestBirth;

  let message: string;
  if (eligible) {
    message = `Eligible — you are ${completedYears} years old on the reference date (allowed ${minAge}–${maxAge}).`;
  } else if (dob > latestBirth) {
    message = `Not eligible — you are only ${completedYears} years old; minimum age is ${minAge}.`;
  } else {
    message = `Not eligible — you exceed the maximum age of ${maxAge} years on the reference date.`;
  }

  return { eligible, completedYears, earliestBirth, latestBirth, message };
}

export interface CyclePrediction {
  nextPeriod: Date;
  ovulation: Date;
  fertileStart: Date;
  fertileEnd: Date;
  cycleLength: number;
}

export function predictMenstrualCycle(lastPeriod: Date, cycleLengthDays: number): CyclePrediction {
  const length = Math.max(21, Math.min(45, cycleLengthDays));
  const nextPeriod = new Date(lastPeriod);
  nextPeriod.setDate(nextPeriod.getDate() + length);

  const ovulation = new Date(nextPeriod);
  ovulation.setDate(ovulation.getDate() - 14);

  const fertileStart = new Date(ovulation);
  fertileStart.setDate(fertileStart.getDate() - 5);

  const fertileEnd = new Date(ovulation);
  fertileEnd.setDate(fertileEnd.getDate() + 1);

  return {
    nextPeriod,
    ovulation,
    fertileStart,
    fertileEnd,
    cycleLength: length,
  };
}
