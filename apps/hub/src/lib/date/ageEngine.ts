export interface AgeResult {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  compareLabel: string;
  birthLabel: string;
  invalid?: string;
}

export function parseDateOnly(iso: string): Date | null {
  if (!iso) return null;
  const [y, mo, da] = iso.split('-').map(Number);
  if (!y || !mo || !da) return null;
  const date = new Date(y, mo - 1, da);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== da) return null;
  return date;
}

export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar-accurate Y/M/D difference accounting for leap years. */
export function diffYmd(from: Date, to: Date): { years: number; months: number; days: number } {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function daysBetween(from: Date, to: Date): number {
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((utcTo - utcFrom) / 86_400_000);
}

function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function calculateAge(dobIso: string, compareIso: string): AgeResult | null {
  const dob = parseDateOnly(dobIso);
  const compare = parseDateOnly(compareIso);
  if (!dob || !compare) return null;

  if (compare < dob) {
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      compareLabel: '',
      birthLabel: formatWeekday(dob),
      invalid: 'Compare date must be on or after date of birth.',
    };
  }

  const { years, months, days } = diffYmd(dob, compare);
  return {
    years,
    months,
    days,
    totalDays: daysBetween(dob, compare),
    compareLabel: formatWeekday(compare),
    birthLabel: formatWeekday(dob),
  };
}
