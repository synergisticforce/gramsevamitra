export type BodyFatSex = 'male' | 'female';

/** US Navy circumference method — all lengths in inches. */
export function computeNavyBodyFatPercent(
  sex: BodyFatSex,
  heightInches: number,
  neckInches: number,
  waistInches: number,
  hipInches: number,
): number | null {
  if (heightInches <= 0 || neckInches <= 0 || waistInches <= 0) return null;

  if (sex === 'male') {
    if (waistInches <= neckInches) return null;
    const logWaistNeck = Math.log10(waistInches - neckInches);
    const logHeight = Math.log10(heightInches);
    const density = 1.0324 - 0.19077 * logWaistNeck + 0.15456 * logHeight;
    if (density <= 0) return null;
    return 495 / density - 450;
  }

  if (hipInches <= 0) return null;
  const sum = waistInches + hipInches - neckInches;
  if (sum <= 0) return null;
  const logSum = Math.log10(sum);
  const logHeight = Math.log10(heightInches);
  const density = 1.29579 - 0.35004 * logSum + 0.221 * logHeight;
  if (density <= 0) return null;
  return 495 / density - 450;
}

export function bodyFatCategory(
  sex: BodyFatSex,
  percent: number,
): { label: string; description: string } {
  if (!Number.isFinite(percent)) {
    return { label: '—', description: 'Enter valid measurements.' };
  }

  if (sex === 'male') {
    if (percent < 6) return { label: 'Essential fat', description: 'Below typical athletic range.' };
    if (percent < 14) return { label: 'Athletic', description: 'Common range for fit men.' };
    if (percent < 18) return { label: 'Fitness', description: 'Healthy active range.' };
    if (percent < 25) return { label: 'Average', description: 'Typical adult male range.' };
    return { label: 'Above average', description: 'Consider lifestyle review with a clinician.' };
  }

  if (percent < 14) return { label: 'Essential fat', description: 'Below typical athletic range.' };
  if (percent < 21) return { label: 'Athletic', description: 'Common range for fit women.' };
  if (percent < 25) return { label: 'Fitness', description: 'Healthy active range.' };
  if (percent < 32) return { label: 'Average', description: 'Typical adult female range.' };
  return { label: 'Above average', description: 'Consider lifestyle review with a clinician.' };
}
