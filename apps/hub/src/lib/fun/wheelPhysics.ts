export interface WheelItem {
  label: string;
  weight: number;
}

export interface WheelPhysicsState {
  rotation: number;
  angularVelocity: number;
  isSpinning: boolean;
}

export const WHEEL_COLORS = [
  '#10b981',
  '#059669',
  '#047857',
  '#34d399',
  '#6ee7b7',
  '#0ea5e9',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

const FRICTION = 0.985;
const MIN_VELOCITY = 0.002;

export function parseWheelItems(text: string): WheelItem[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const weightMatch = line.match(/^(.+?)\s*\[(\d+(?:\.\d+)?)\]\s*$/);
      if (weightMatch) {
        return { label: weightMatch[1].trim(), weight: Math.max(0.1, Number(weightMatch[2])) };
      }
      return { label: line.replace(/,\s*$/, ''), weight: 1 };
    })
    .filter((item) => item.label.length > 0);
}

export function totalWeight(items: WheelItem[]): number {
  return items.reduce((sum, item) => sum + item.weight, 0);
}

/** Map pointer angle (top = -π/2) to winning item index. */
export function winnerIndex(items: WheelItem[], rotation: number): number {
  if (items.length === 0) return -1;
  const total = totalWeight(items);
  const pointer = ((-rotation - Math.PI / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const slice = (items[i].weight / total) * Math.PI * 2;
    if (pointer >= cursor && pointer < cursor + slice) return i;
    cursor += slice;
  }
  return items.length - 1;
}

export function spinImpulse(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const base = 0.35 + (buf[0] % 200) / 400;
  return base + Math.PI * (4 + (buf[0] % 3));
}

export function stepPhysics(state: WheelPhysicsState, dt: number): WheelPhysicsState {
  if (!state.isSpinning) return state;
  let { rotation, angularVelocity } = state;
  rotation += angularVelocity * dt;
  angularVelocity *= Math.pow(FRICTION, dt * 60);
  const isSpinning = Math.abs(angularVelocity) > MIN_VELOCITY;
  if (!isSpinning) angularVelocity = 0;
  return { rotation, angularVelocity, isSpinning };
}

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

export function spawnConfetti(width: number, height: number, count = 80): ConfettiParticle[] {
  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < count; i++) {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    particles.push({
      x: width * 0.5 + ((buf[0] % 100) - 50),
      y: height * 0.35,
      vx: ((buf[1] % 100) - 50) / 8,
      vy: -2 - (buf[0] % 80) / 20,
      color: WHEEL_COLORS[buf[1] % WHEEL_COLORS.length],
      size: 4 + (buf[0] % 6),
      life: 1,
    });
  }
  return particles;
}

export function tickConfetti(particles: ConfettiParticle[], dt: number, height: number): ConfettiParticle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx,
      y: p.y + p.vy,
      vy: p.vy + 0.15 * dt * 60,
      life: p.life - 0.012 * dt * 60,
    }))
    .filter((p) => p.life > 0 && p.y < height + 40);
}
