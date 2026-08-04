import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  isVaultLockEnabled,
  verifyVaultPin,
} from '../../shared/services/vaultLock';

interface Props {
  children: ReactNode;
}

/** Wrong-PIN attempts before a short cool-off, to blunt guessing. */
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;

export default function VaultLockGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLocked(await isVaultLockEnabled());
      } catch {
        setLocked(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const coolingDown = lockedUntil > Date.now();

  const submit = useCallback(async () => {
    if (verifying || coolingDown) return;
    setVerifying(true);
    setError(null);
    try {
      if (await verifyVaultPin(pin)) {
        setLocked(false);
        setPin('');
        setAttempts(0);
        return;
      }

      const next = attempts + 1;
      setAttempts(next);
      setPin('');
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + COOLDOWN_MS);
        setAttempts(0);
        setError('Too many wrong tries. Please wait 30 seconds.');
      } else {
        setError(`Wrong PIN. ${MAX_ATTEMPTS - next} tries left.`);
      }
    } catch {
      setError('Could not check your PIN. Please try again.');
    } finally {
      setVerifying(false);
    }
  }, [attempts, coolingDown, pin, verifying]);

  if (checking) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (!locked) return <>{children}</>;

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-5 px-4 py-10">
      <div className="text-center">
        <span className="text-4xl" aria-hidden="true">
          🔒
        </span>
        <h1 className="mt-3 text-xl font-bold text-canvas-text">Your documents are locked</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
          Enter your PIN to open your saved documents.
        </p>
      </div>

      <label className="block">
        <span className="sr-only">Vault PIN</span>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          disabled={verifying || coolingDown}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="••••"
          className="min-h-14 w-full rounded-2xl border border-canvas-border bg-canvas-surface px-4 text-center text-2xl tracking-[0.5em] text-canvas-text outline-none focus:border-canvas-accent disabled:opacity-60"
        />
      </label>

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-4 py-3 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={verifying || coolingDown || pin.length < 4}
        className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-canvas-accent-muted px-5 text-base font-bold text-canvas-text transition hover:bg-canvas-accent/40 disabled:opacity-50"
      >
        {verifying ? 'Checking…' : 'Unlock'}
      </button>

      <p className="text-center text-xs font-medium leading-relaxed text-slate-400">
        Your PIN is stored only on this phone. Your files stay saved even if you forget it — you can
        turn the lock off from the vault screen after unlocking.
      </p>
    </section>
  );
}
