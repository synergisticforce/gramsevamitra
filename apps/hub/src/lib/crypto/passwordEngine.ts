export const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!@#$%^&*()-_=+[]{}|;:,.<>?',
} as const;

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  special: boolean;
}

function secureRandomInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

export function buildCharsetPool(options: PasswordOptions): string {
  let pool = '';
  if (options.upper) pool += CHARSETS.upper;
  if (options.lower) pool += CHARSETS.lower;
  if (options.numbers) pool += CHARSETS.numbers;
  if (options.special) pool += CHARSETS.special;
  return pool;
}

export function requiredSets(options: PasswordOptions): string[] {
  const sets: string[] = [];
  if (options.upper) sets.push(CHARSETS.upper);
  if (options.lower) sets.push(CHARSETS.lower);
  if (options.numbers) sets.push(CHARSETS.numbers);
  if (options.special) sets.push(CHARSETS.special);
  return sets;
}

export function generatePassword(options: PasswordOptions): string | null {
  const length = Math.round(Math.min(128, Math.max(8, options.length)));
  const pool = buildCharsetPool(options);
  if (!pool) return null;

  const chars = Array.from({ length }, () => pool[secureRandomInt(pool.length)]);

  for (const set of requiredSets(options)) {
    if (!chars.some((ch) => set.includes(ch))) {
      const idx = secureRandomInt(chars.length);
      chars[idx] = set[secureRandomInt(set.length)];
    }
  }

  return chars.join('');
}
