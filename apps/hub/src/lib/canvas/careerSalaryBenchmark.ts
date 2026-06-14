/** Regional salary benchmark data — compiled locally for Career Prep (tier-1 / tier-2 India). */

export type ExperienceTier = 'fresher' | 'mid' | 'senior';
export type RegionTier = 'tier1' | 'tier2';

export interface SalaryBandLpa {
  label: string;
  min: number;
  mid: number;
  max: number;
}

export interface BenchmarkRole {
  id: string;
  role: string;
  bands: Record<ExperienceTier, SalaryBandLpa>;
}

export const REGION_OPTIONS: { id: RegionTier; label: string; multiplier: number; cities: string }[] = [
  {
    id: 'tier1',
    label: 'Tier-1 metros',
    multiplier: 1,
    cities: 'Bangalore, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai',
  },
  {
    id: 'tier2',
    label: 'Tier-2 cities',
    multiplier: 0.82,
    cities: 'Jaipur, Kochi, Bhubaneswar, Indore, Lucknow, Coimbatore',
  },
];

export const EXPERIENCE_OPTIONS: { id: ExperienceTier; label: string }[] = [
  { id: 'fresher', label: '0–2 years (Fresher)' },
  { id: 'mid', label: '3–7 years (Mid-level)' },
  { id: 'senior', label: '8+ years (Senior)' },
];

/** Base CTC benchmarks (₹ LPA) before regional adjustment — indicative 2025–26 India market. */
export const BENCHMARK_ROLES: BenchmarkRole[] = [
  {
    id: 'software-engineer',
    role: 'Software Engineer',
    bands: {
      fresher: { label: '0–2 years', min: 4, mid: 8, max: 12 },
      mid: { label: '3–7 years', min: 10, mid: 18, max: 28 },
      senior: { label: '8+ years', min: 20, mid: 35, max: 55 },
    },
  },
  {
    id: 'frontend-developer',
    role: 'Frontend Developer',
    bands: {
      fresher: { label: '0–2 years', min: 4.5, mid: 9, max: 13 },
      mid: { label: '3–7 years', min: 11, mid: 19, max: 30 },
      senior: { label: '8+ years', min: 22, mid: 36, max: 52 },
    },
  },
  {
    id: 'data-analyst',
    role: 'Data Analyst',
    bands: {
      fresher: { label: '0–2 years', min: 3, mid: 6, max: 9 },
      mid: { label: '3–7 years', min: 7, mid: 12, max: 18 },
      senior: { label: '8+ years', min: 14, mid: 22, max: 32 },
    },
  },
  {
    id: 'product-manager',
    role: 'Product Manager',
    bands: {
      fresher: { label: '0–2 years', min: 8, mid: 14, max: 20 },
      mid: { label: '3–7 years', min: 16, mid: 26, max: 38 },
      senior: { label: '8+ years', min: 28, mid: 42, max: 60 },
    },
  },
  {
    id: 'accountant',
    role: 'Accountant',
    bands: {
      fresher: { label: '0–2 years', min: 2.5, mid: 4.5, max: 7 },
      mid: { label: '3–7 years', min: 5, mid: 8, max: 12 },
      senior: { label: '8+ years', min: 10, mid: 16, max: 24 },
    },
  },
  {
    id: 'ux-designer',
    role: 'UX Designer',
    bands: {
      fresher: { label: '0–2 years', min: 4, mid: 7, max: 11 },
      mid: { label: '3–7 years', min: 9, mid: 15, max: 22 },
      senior: { label: '8+ years', min: 18, mid: 28, max: 40 },
    },
  },
  {
    id: 'sales-executive',
    role: 'Sales Executive',
    bands: {
      fresher: { label: '0–2 years', min: 2.5, mid: 5, max: 8 },
      mid: { label: '3–7 years', min: 5, mid: 10, max: 16 },
      senior: { label: '8+ years', min: 10, mid: 18, max: 30 },
    },
  },
  {
    id: 'nurse',
    role: 'Registered Nurse',
    bands: {
      fresher: { label: '0–2 years', min: 2.5, mid: 4, max: 6 },
      mid: { label: '3–7 years', min: 4.5, mid: 7, max: 10 },
      senior: { label: '8+ years', min: 8, mid: 12, max: 18 },
    },
  },
];

export interface RegionalBenchmarkResult {
  role: string;
  experienceLabel: string;
  regionLabel: string;
  regionCities: string;
  min: number;
  mid: number;
  max: number;
}

export function lookupRegionalBenchmark(
  roleId: string,
  experience: ExperienceTier,
  region: RegionTier
): RegionalBenchmarkResult | null {
  const roleEntry = BENCHMARK_ROLES.find((r) => r.id === roleId);
  const regionEntry = REGION_OPTIONS.find((r) => r.id === region);
  if (!roleEntry || !regionEntry) return null;

  const band = roleEntry.bands[experience];
  if (!band) return null;

  const m = regionEntry.multiplier;
  const round = (v: number) => Math.round(v * 10) / 10;

  return {
    role: roleEntry.role,
    experienceLabel: band.label,
    regionLabel: regionEntry.label,
    regionCities: regionEntry.cities,
    min: round(band.min * m),
    mid: round(band.mid * m),
    max: round(band.max * m),
  };
}

export function formatLpa(value: number): string {
  return `₹${value.toFixed(1)} LPA`;
}

export const CAREER_SALARY_BENCHMARK_STORAGE_KEY = 'gsm-canvas-career:salary-benchmark';

export interface SalaryBenchmarkPrefs {
  roleId: string;
  experience: ExperienceTier;
  region: RegionTier;
}

export const DEFAULT_SALARY_BENCHMARK_PREFS: SalaryBenchmarkPrefs = {
  roleId: 'software-engineer',
  experience: 'mid',
  region: 'tier1',
};

export function loadSalaryBenchmarkPrefs(): SalaryBenchmarkPrefs {
  if (typeof window === 'undefined') return { ...DEFAULT_SALARY_BENCHMARK_PREFS };
  try {
    const raw = localStorage.getItem(CAREER_SALARY_BENCHMARK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SALARY_BENCHMARK_PREFS };
    return { ...DEFAULT_SALARY_BENCHMARK_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SALARY_BENCHMARK_PREFS };
  }
}

export function saveSalaryBenchmarkPrefs(prefs: SalaryBenchmarkPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_SALARY_BENCHMARK_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
