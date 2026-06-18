import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  computeTypingStats,
  pickTypingPassage,
} from '../../lib/quick/quickToolEngines';

type Phase = 'idle' | 'running' | 'done';

interface FormState {
  lastWpm: number;
  lastAccuracy: number;
}

const DEFAULTS: FormState = { lastWpm: 0, lastAccuracy: 0 };

const INPUT_CLASS =
  'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-sm text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

export default function QuickTypingSpeedTest() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.typingSpeed, DEFAULTS),
    [],
  );
  const [passage, setPassage] = useState('');
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lastWpm, setLastWpm] = useState(initial.lastWpm);
  const [lastAccuracy, setLastAccuracy] = useState(initial.lastAccuracy);
  const startRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const liveStats = useMemo(() => {
    if (phase !== 'running' || !startRef.current) return null;
    return computeTypingStats(passage, typed, elapsedMs);
  }, [elapsedMs, passage, phase, typed]);

  const resetPassage = useCallback(() => {
    setPassage(pickTypingPassage());
    setTyped('');
    setPhase('idle');
    setElapsedMs(0);
    startRef.current = null;
  }, []);

  useEffect(() => {
    resetPassage();
  }, [resetPassage]);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      if (startRef.current) setElapsedMs(Date.now() - startRef.current);
    }, 200);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.typingSpeed, { lastWpm, lastAccuracy });
  }, [lastAccuracy, lastWpm]);

  const startTest = () => {
    setPassage(pickTypingPassage());
    setTyped('');
    setPhase('running');
    startRef.current = Date.now();
    setElapsedMs(0);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleChange = (value: string) => {
    if (phase === 'idle') {
      setPhase('running');
      startRef.current = Date.now();
    }
    setTyped(value);

    if (value.length >= passage.length) {
      const ms = startRef.current ? Date.now() - startRef.current : 0;
      const stats = computeTypingStats(passage, value.slice(0, passage.length), ms);
      setLastWpm(stats.wpm);
      setLastAccuracy(stats.accuracy);
      setPhase('done');
    }
  };

  const renderPassage = () => {
    return passage.split('').map((char, i) => {
      let className = 'text-slate-300';
      if (i < typed.length) {
        className = typed[i] === char ? 'text-emerald-300' : 'text-rose-400 bg-rose-950/40';
      } else if (i === typed.length && phase === 'running') {
        className = 'text-white underline decoration-violet-400';
      }
      return (
        <span key={`${i}-${char}`} className={className}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3">
          <p className="text-xs font-medium text-slate-300">Live WPM</p>
          <p className="text-2xl font-bold text-white tabular-nums">{liveStats?.wpm ?? lastWpm}</p>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3">
          <p className="text-xs font-medium text-slate-300">Accuracy</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {(liveStats?.accuracy ?? lastAccuracy).toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3">
          <p className="text-xs font-medium text-slate-300">Time</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {(elapsedMs / 1000).toFixed(1)}s
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-canvas-border bg-canvas-surface p-4 text-sm font-medium leading-relaxed">
        {renderPassage()}
      </div>

      <textarea
        ref={inputRef}
        value={typed}
        onChange={(e) => handleChange(e.target.value)}
        disabled={phase === 'done'}
        rows={4}
        placeholder="Start typing to begin the test…"
        className={INPUT_CLASS}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startTest}
          className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-canvas-accent/40"
        >
          {phase === 'done' ? 'Try another passage' : 'New passage'}
        </button>
        {phase === 'done' && (
          <p className="self-center text-sm font-medium text-slate-200">
            Finished — {lastWpm} WPM at {lastAccuracy.toFixed(1)}% accuracy
          </p>
        )}
      </div>
    </div>
  );
}
