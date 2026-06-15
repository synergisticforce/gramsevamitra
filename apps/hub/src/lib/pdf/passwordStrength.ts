export function scorePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  barClass: string;
  textClass: string;
} {
  let score = 0;
  if (password.length >= 6) score += 15;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 10;
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 15;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  if (score < 40) {
    return { score, label: 'Weak', barClass: 'bg-rose-500', textClass: 'text-rose-600' };
  }
  if (score < 65) {
    return { score, label: 'Fair', barClass: 'bg-canvas-elevated0', textClass: 'text-canvas-muted' };
  }
  if (score < 85) {
    return { score, label: 'Good', barClass: 'bg-canvas-accent-soft0', textClass: 'text-canvas-accent' };
  }
  return { score, label: 'Strong', barClass: 'bg-canvas-accent-muted', textClass: 'text-canvas-accent' };
}
