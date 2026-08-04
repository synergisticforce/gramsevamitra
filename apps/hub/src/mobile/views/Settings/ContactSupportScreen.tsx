import { useState, type FormEvent } from 'react';
import { contactService } from '../../../shared/services/ContactService';

export interface ContactSupportScreenProps {
  onBack?: () => void;
}

const fieldClass =
  'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-3 text-sm font-medium text-canvas-text placeholder:text-slate-400 focus:border-canvas-accent focus:outline-none focus:ring-2 focus:ring-canvas-accent/30';

export default function ContactSupportScreen({ onBack }: ContactSupportScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setError('Please fill in every field before sending.');
      return;
    }

    setBusy(true);
    try {
      const result = await contactService.submitContactForm({
        name,
        email,
        subject,
        message,
      });

      if (!result.success) {
        setError(result.error || 'Unable to send your message.');
        return;
      }

      setSuccess(
        result.message ||
          `Message sent successfully to ${contactService.supportEmail}!`,
      );
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-300 transition hover:bg-canvas-elevated hover:text-canvas-text"
            >
              ← Back
            </button>
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
            Support
          </p>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">Contact Support</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Send a message to{' '}
          <a
            href={`mailto:${contactService.supportEmail}`}
            className="font-semibold text-emerald-300 underline decoration-emerald-500/40 underline-offset-2"
          >
            {contactService.supportEmail}
          </a>
          . We read every request.
        </p>
      </header>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Name</span>
          <input
            type="text"
            name="name"
            autoComplete="name"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={busy}
            className={fieldClass}
            placeholder="Your name"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            className={fieldClass}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Subject
          </span>
          <input
            type="text"
            name="subject"
            maxLength={200}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={busy}
            className={fieldClass}
            placeholder="Billing, bug report, feature idea…"
            required
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Message
          </span>
          <textarea
            name="message"
            rows={6}
            maxLength={5000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={busy}
            className={`${fieldClass} resize-y`}
            placeholder="How can we help?"
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-canvas-accent-muted px-6 py-4 text-base font-bold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-text"
                aria-hidden="true"
              />
              Sending…
            </>
          ) : (
            'Send message'
          )}
        </button>
      </form>

      {success && (
        <p
          className="rounded-xl border border-emerald-500/40 bg-canvas-accent-soft px-4 py-3 text-sm font-medium text-canvas-text"
          role="status"
        >
          {success}
        </p>
      )}
      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-4 py-3 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
