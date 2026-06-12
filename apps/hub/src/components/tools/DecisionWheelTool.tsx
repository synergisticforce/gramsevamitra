import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseWheelItems,
  spawnConfetti,
  spinImpulse,
  stepPhysics,
  tickConfetti,
  totalWeight,
  winnerIndex,
  WHEEL_COLORS,
  type ConfettiParticle,
  type WheelItem,
} from '../../lib/fun/wheelPhysics';

const STORAGE_KEY = 'gsm-tools:decision-wheel';

export default function DecisionWheelTool() {
  const [optionsText, setOptionsText] = useState('Pizza\nBiryani\nDosa\nBurger');
  const [result, setResult] = useState('Add at least 2 options and spin');
  const [isSpinning, setIsSpinning] = useState(false);

  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const itemsRef = useRef<WheelItem[]>([]);
  const physicsRef = useRef({ rotation: 0, angularVelocity: 0, isSpinning: false });
  const confettiRef = useRef<ConfettiParticle[]>([]);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const finishedRef = useRef(false);

  const drawWheel = useCallback((highlightIdx = -1) => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const items = itemsRef.current;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 6;
    const rotation = physicsRef.current.rotation;

    ctx.clearRect(0, 0, w, h);

    if (items.length === 0) {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = '14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Add options', cx, cy);
      return;
    }

    const total = totalWeight(items);
    let angle = rotation;

    items.forEach((item, i) => {
      const slice = (item.weight / total) * Math.PI * 2;
      const start = angle;
      const end = angle + slice;
      const isHighlight = i === highlightIdx;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = isHighlight ? '#fbbf24' : WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = isHighlight ? '#1e293b' : '#f8fafc';
      ctx.font = `bold ${items.length > 6 ? 10 : 12}px system-ui, sans-serif`;
      const maxLen = items.length > 8 ? 8 : 14;
      const text = item.label.length > maxLen ? `${item.label.slice(0, maxLen - 1)}…` : item.label;
      ctx.fillText(text, r - 12, 4);
      ctx.restore();

      angle = end;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  const drawConfetti = useCallback(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of confettiRef.current) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
    }
    ctx.globalAlpha = 1;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const dt = lastTimeRef.current ? (now - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = now;

      const prev = physicsRef.current;
      physicsRef.current = stepPhysics(prev, dt || 1 / 60);

      if (prev.isSpinning || physicsRef.current.isSpinning) {
        drawWheel(-1);
      }

      if (prev.isSpinning && !physicsRef.current.isSpinning && !finishedRef.current) {
        finishedRef.current = true;
        const winner = winnerIndex(itemsRef.current, physicsRef.current.rotation);
        const label = itemsRef.current[winner]?.label ?? '';
        setResult(`🎉 ${label}!`);
        setIsSpinning(false);
        const canvas = confettiCanvasRef.current;
        if (canvas) {
          confettiRef.current = spawnConfetti(canvas.width, canvas.height);
        }
        drawWheel(winner);
      }

      if (confettiRef.current.length > 0) {
        confettiRef.current = tickConfetti(confettiRef.current, dt || 1 / 60, confettiCanvasRef.current?.height ?? 400);
        drawConfetti();
      }

      if (physicsRef.current.isSpinning || confettiRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [drawWheel, drawConfetti],
  );

  const spin = useCallback(() => {
    if (isSpinning) return;
    const items = parseWheelItems(optionsText);
    itemsRef.current = items;
    if (items.length < 2) {
      setResult('Add at least 2 options (one per line).');
      drawWheel();
      return;
    }

    finishedRef.current = false;
    setIsSpinning(true);
    confettiRef.current = [];
    setResult('Spinning…');
    physicsRef.current = {
      rotation: physicsRef.current.rotation,
      angularVelocity: spinImpulse(),
      isSpinning: true,
    };
    lastTimeRef.current = 0;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    try {
      localStorage.setItem(STORAGE_KEY, optionsText);
    } catch {
      /* ignore */
    }
  }, [isSpinning, optionsText, drawWheel, tick]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOptionsText(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    itemsRef.current = parseWheelItems(optionsText);
    if (!isSpinning) {
      setResult('Add at least 2 options and spin');
      drawWheel();
    }
  }, [optionsText, drawWheel, isSpinning]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Wheel entries</h2>
        <p className="mt-1 text-xs text-slate-500">
          One option per line. Optional weight syntax: <code className="text-emerald-400">Option [2]</code>
        </p>
        <label className="mt-4 block">
          <textarea
            rows={6}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            className="input-field w-full resize-y text-sm"
            placeholder={'Pizza\nBiryani\nDosa'}
            disabled={isSpinning}
          />
        </label>
        <button type="button" onClick={spin} disabled={isSpinning} className="btn-primary mt-4 w-full text-sm">
          {isSpinning ? 'Spinning…' : 'Spin the wheel!'}
        </button>
      </section>

      <section className="relative mx-auto max-w-md text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1">
          <div className="h-0 w-0 border-x-[14px] border-x-transparent border-t-[22px] border-t-emerald-400 drop-shadow" />
        </div>
        <div className="relative">
          <canvas
            ref={wheelCanvasRef}
            width={340}
            height={340}
            className="mx-auto rounded-full border-4 border-slate-700 shadow-xl"
            role="img"
            aria-label="Decision wheel"
          />
          <canvas
            ref={confettiCanvasRef}
            width={340}
            height={400}
            className="pointer-events-none absolute inset-x-0 top-0 mx-auto"
            aria-hidden
          />
        </div>
        <p className="mt-6 text-lg font-bold text-emerald-400" aria-live="polite">
          {result}
        </p>
      </section>
    </div>
  );
}
