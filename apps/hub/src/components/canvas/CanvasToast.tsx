import { useCallback, useEffect, useState } from 'react';

interface Props {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

export default function CanvasToast({ message, onDismiss, durationMs = 4200 }: Props) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[70] w-[min(92vw,24rem)] -translate-x-1/2"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-lg">
        {message}
      </div>
    </div>
  );
}
