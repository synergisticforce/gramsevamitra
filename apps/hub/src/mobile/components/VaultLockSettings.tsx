import { useCallback, useEffect, useState } from 'react';
import {
  isVaultLockEnabled,
  isVaultLockSupported,
  removeVaultPin,
  setVaultPin,
  validatePin,
} from '../../shared/services/vaultLock';

interface Props {
  onClose: () => void;
  onChanged: (message: string) => void;
}

export default function VaultLockSettings({ onClose, onChanged }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setEnabled(await isVaultLockEnabled());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleEnable = useCallback(async () => {
    setError(null);
    const problem = validatePin(pin);
    if (problem) {
      setError(problem);
      return;
    }
    if (pin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }

    setBusy(true);
    try {
      await setVaultPin(pin);
      onChanged('PIN lock turned on. You will be asked for it next time.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the PIN.');
    } finally {
      setBusy(false);
    }
  }, [confirmPin, onChanged, onClose, pin]);

  const handleDisable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      await removeVaultPin(currentPin);
      onChanged('PIN lock turned off.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off the PIN.');
    } finally {
      setBusy(false);
    }
  }, [currentPin, onChanged, onClose]);

  const inputClass =
    'mt-1 min-h-12 w-full rounded-xl border border-canvas-border bg-canvas-elevated px-4 text-center text-lg tracking-[0.35em] text-canvas-text outline-none focus:border-canvas-accent';

  return (
    <div
      className="fixed inset-0 z-[85] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-lock-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-canvas-border bg-canvas-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="vault-lock-title" className="text-base font-bold text-canvas-text">
            PIN lock
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-canvas-border text-canvas-muted disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm font-medium text-slate-300">Loading…</p>
        ) : !isVaultLockSupported() ? (
          <p className="mt-4 text-sm font-medium leading-relaxed text-slate-300">
            This device cannot set a PIN lock.
          </p>
        ) : enabled ? (
          <>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">
              Your documents ask for a PIN before opening. Enter your PIN to turn this off.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Current PIN
              </span>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                disabled={busy}
                onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                className={inputClass}
              />
            </label>
            {error && (
              <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleDisable()}
              disabled={busy || currentPin.length < 4}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-canvas-border text-sm font-semibold text-rose-200 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Turn off PIN lock'}
            </button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium leading-relaxed text-slate-200">
              Ask for a PIN before showing your saved documents. Useful if you keep Aadhaar, land
              records, or certificates on this phone.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                New PIN (4–12 digits)
              </span>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                disabled={busy}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                className={inputClass}
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Confirm PIN
              </span>
              <input
                type="password"
                inputMode="numeric"
                value={confirmPin}
                disabled={busy}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 12))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleEnable();
                }}
                className={inputClass}
              />
            </label>
            {error && (
              <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleEnable()}
              disabled={busy || pin.length < 4}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-canvas-accent-muted text-sm font-bold text-canvas-text disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Turn on PIN lock'}
            </button>
            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-400">
              Your files are not deleted if you forget the PIN, but anyone who knows it can open
              them. Choose something only you know.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
