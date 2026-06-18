export type BmiUnitSystem = 'metric' | 'imperial';

export interface BmiResult {
  value: number;
  category: BmiCategory;
}

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const BMI_CATEGORY_META: Record<
  BmiCategory,
  { label: string; range: string; description: string; barColor: string }
> = {
  underweight: {
    label: 'Underweight',
    range: 'Below 18.5',
    description: 'May indicate insufficient nutrition — consult a healthcare provider if unintended.',
    barColor: 'bg-sky-400',
  },
  normal: {
    label: 'Healthy range',
    range: '18.5 – 24.9',
    description: 'Associated with lower risk for weight-related health issues.',
    barColor: 'bg-emerald-400',
  },
  overweight: {
    label: 'Overweight',
    range: '25.0 – 29.9',
    description: 'Elevated risk — lifestyle changes may help; seek medical advice for a plan.',
    barColor: 'bg-amber-400',
  },
  obese: {
    label: 'Obese',
    range: '30.0 and above',
    description: 'Higher health risk category — professional guidance is recommended.',
    barColor: 'bg-rose-400',
  },
};

export function computeBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0 || weightKg <= 0) return NaN;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function computeBmiImperial(weightLbs: number, heightInches: number): number {
  if (heightInches <= 0 || weightLbs <= 0) return NaN;
  return (703 * weightLbs) / (heightInches * heightInches);
}

export function classifyBmi(bmi: number): BmiCategory {
  if (!Number.isFinite(bmi)) return 'normal';
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function lbsToKg(lbs: number): number {
  return lbs * 0.45359237;
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

export function feetInchesToInches(feet: number, inches: number): number {
  return feet * 12 + inches;
}
