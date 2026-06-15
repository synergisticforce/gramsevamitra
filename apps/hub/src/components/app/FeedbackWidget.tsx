import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { SUPPORT_EMAIL } from './AppShellFooter';

const FEEDBACK_SUBJECT = 'GramSeva Mitra Feedback';

function buildMailtoHref(message: string): string {
  const body = message.trim() || '(No message provided)';
  const params = new URLSearchParams({
    subject: FEEDBACK_SUBJECT,
    body,
  });
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

function SpeechBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [open, close]);

  const submit = () => {
    window.location.href = buildMailtoHref(message);
    close();
    setMessage('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-canvas-border bg-canvas-surface text-canvas-accent shadow-none shadow-violet-900/10 transition hover:border-violet-300 hover:bg-canvas-accent-soft hover:text-violet-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:bottom-6"
        aria-label="Send feedback"
        title="Send feedback"
      >
        <SpeechBubbleIcon className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[55] flex items-end justify-center bg-canvas-accent-muted/40 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={close}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-widget-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
              <div>
                <h2 id="feedback-widget-title" className="text-base font-semibold text-canvas-text">
                  Send feedback
                </h2>
                <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">
                  Tell us what&apos;s working or what we should improve.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-canvas-border px-2 py-1 text-sm font-medium leading-relaxed text-slate-200 transition hover:bg-canvas-elevated"
                aria-label="Close feedback form"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <label htmlFor={textareaId} className="sr-only">
                Your feedback message
              </label>
              <textarea
                ref={textareaRef}
                id={textareaId}
                rows={4}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Share a bug, idea, or quick note…"
                className="w-full resize-y rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-sm text-canvas-text placeholder:text-canvas-subtle focus:border-violet-400 focus:bg-canvas-surface focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <p className="text-[11px] leading-relaxed text-canvas-subtle">
                Submit opens your email app with a pre-filled message to{' '}
                <span className="font-medium text-canvas-muted">{SUPPORT_EMAIL}</span>.
              </p>
              <button
                type="button"
                onClick={submit}
                className="w-full rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
