export type TdeeSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';
export type FitnessGoal = 'cut' | 'maintain' | 'bulk';

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, { factor: number; label: string }> = {
  sedentary: { factor: 1.2, label: 'Sedentary (desk job, little exercise)' },
  light: { factor: 1.375, label: 'Light (1–3 workouts / week)' },
  moderate: { factor: 1.55, label: 'Moderate (3–5 workouts / week)' },
  active: { factor: 1.725, label: 'Active (daily exercise)' },
  'very-active': { factor: 1.9, label: 'Very active (physical job + training)' },
};

export const GOAL_ADJUSTMENTS: Record<FitnessGoal, { delta: number; label: string }> = {
  cut: { delta: -500, label: 'Cut (fat loss)' },
  maintain: { delta: 0, label: 'Maintain weight' },
  bulk: { delta: 300, label: 'Bulk (muscle gain)' },
};

/** Mifflin–St Jeor BMR (kcal/day). */
export function computeBmr(sex: TdeeSex, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

export function computeTdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity].factor;
}

export function computeTargetCalories(tdee: number, goal: FitnessGoal): number {
  return Math.max(1200, Math.round(tdee + GOAL_ADJUSTMENTS[goal].delta));
}

export interface MacroSplit {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  proteinKcal: number;
  carbsKcal: number;
  fatKcal: number;
}

/** Protein prioritized at g/kg; fat at 25% kcal; carbs fill remainder. */
export function computeMacros(
  targetCalories: number,
  weightKg: number,
  goal: FitnessGoal,
): MacroSplit {
  const proteinPerKg = goal === 'cut' ? 2.0 : goal === 'bulk' ? 1.8 : 1.6;
  const proteinG = Math.round(weightKg * proteinPerKg);
  const proteinKcal = proteinG * 4;

  const fatKcal = Math.round(targetCalories * 0.25);
  const fatG = Math.round(fatKcal / 9);

  const carbsKcal = Math.max(0, targetCalories - proteinKcal - fatKcal);
  const carbsG = Math.round(carbsKcal / 4);

  return {
    calories: targetCalories,
    proteinG,
    carbsG,
    fatG,
    proteinKcal,
    carbsKcal,
    fatKcal: fatG * 9,
  };
}
