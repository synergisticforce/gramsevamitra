/** Official-correspondence passages for typing speed practice. */
export const TYPING_PASSAGES: string[] = [
  'Subject: Compliance of quarterly returns under Section 44AB of the Income-tax Act, 1961. Please submit the audited statement before the prescribed due date.',
  'Reference your letter No. F.12/Compliance/2026 dated 15 March 2026 regarding revision of tour programme. The same has been noted for necessary action.',
  'It is requested to furnish utilization certificates in respect of grants released during the financial year 2025-26 at the earliest for audit purposes.',
  'Please ensure that all vouchers are duly supported by sanction orders and that expenditure is booked under the correct head of account.',
  'The undersigned is directed to refer to this office memorandum dated 01 April 2026 on maintenance of registers and records as per applicable rules.',
  'Kindly arrange to forward the inspection report along with annexures in triplicate for further examination by the competent authority.',
  'In partial modification of earlier instructions, it has been decided that all correspondence shall be routed through the designated nodal officer only.',
  'You are requested to confirm receipt of this communication and indicate the action taken thereon within fifteen days of the date of issue.',
];

export function pickTypingPassage(): string {
  return TYPING_PASSAGES[Math.floor(Math.random() * TYPING_PASSAGES.length)];
}

export function computeTypingStats(
  passage: string,
  typed: string,
  elapsedMs: number,
): { wpm: number; accuracy: number; correct: number; total: number } {
  const total = typed.length;
  let correct = 0;
  for (let i = 0; i < typed.length; i += 1) {
    if (typed[i] === passage[i]) correct += 1;
  }

  const minutes = elapsedMs / 60_000;
  const wpm = minutes > 0 ? Math.round((correct / 5) / minutes) : 0;
  const accuracy = total > 0 ? Math.round((correct / total) * 1000) / 10 : 100;

  return { wpm, accuracy, correct, total };
}

export function playTimerAlert(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    const t = ctx.currentTime;
    playTone(880, t, 0.25);
    playTone(660, t + 0.3, 0.35);
    void ctx.close();
  } catch {
    /* audio blocked or unsupported */
  }
}

export function generateRandomIntegers(
  min: number,
  max: number,
  count: number,
  allowDuplicates: boolean,
): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error('Min must be less than or equal to Max.');
  }
  if (count < 1 || count > 10_000) {
    throw new Error('Count must be between 1 and 10,000.');
  }

  const range = max - min + 1;
  if (!allowDuplicates && count > range) {
    throw new Error(`Cannot generate ${count} unique values in range ${min}–${max}.`);
  }

  const result: number[] = [];
  const used = new Set<number>();

  while (result.length < count) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const value = min + (buf[0] % range);
    if (!allowDuplicates) {
      if (used.has(value)) continue;
      used.add(value);
    }
    result.push(value);
  }

  return result;
}

export interface CountdownParts {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

export function splitCountdown(targetMs: number, nowMs: number): CountdownParts {
  const diff = targetMs - nowMs;
  if (diff <= 0) {
    return { totalMs: 0, days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  let remaining = Math.floor(diff / 1000);
  const days = Math.floor(remaining / 86_400);
  remaining %= 86_400;
  const hours = Math.floor(remaining / 3600);
  remaining %= 3600;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return { totalMs: diff, days, hours, minutes, seconds, expired: false };
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
