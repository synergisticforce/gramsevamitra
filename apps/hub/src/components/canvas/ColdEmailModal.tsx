import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildColdEmailTemplates,
  COLD_EMAIL_TEMPLATE_META,
  copyColdEmailText,
  DEFAULT_COLD_EMAIL_INPUT,
  loadColdEmailInput,
  saveColdEmailInput,
  type ColdEmailInput,
  type ColdEmailTemplateId,
} from '../../lib/canvas/careerColdEmail';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
  embedded?: boolean;
}

export default function ColdEmailModal({ onClose, onSuccess, embedded = false }: Props) {
  const [form, setForm] = useState<ColdEmailInput>(DEFAULT_COLD_EMAIL_INPUT);
  const [activeTemplate, setActiveTemplate] = useState<ColdEmailTemplateId>('cold');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(loadColdEmailInput());
  }, []);

  const templates = useMemo(() => buildColdEmailTemplates(form), [form]);

  const update = useCallback((patch: Partial<ColdEmailInput>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveColdEmailInput(next);
      return next;
    });
    setError(null);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyColdEmailText(templates[activeTemplate]);
      setCopied(true);
      onSuccess('Email template copied to clipboard.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Check browser permissions.');
    }
  }, [activeTemplate, onSuccess, templates]);

  const content = (
    <div className={embedded ? 'space-y-4' : 'max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none'}>
      {!embedded && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cold-email-title" className="text-lg font-bold text-canvas-text">
              ✉️ Cold Email Builder
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
              Outreach, interview follow-up &amp; thank-you templates — nothing leaves your device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-canvas-subtle transition hover:bg-canvas-elevated hover:text-canvas-muted"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      <div className={`grid gap-4 lg:grid-cols-2 ${embedded ? '' : 'mt-4'}`}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Your name
              </span>
              <input
                value={form.userName}
                onChange={(event) => update({ userName: event.target.value })}
                placeholder="e.g. Priya Sharma"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Target role
              </span>
              <input
                value={form.targetRole}
                onChange={(event) => update({ targetRole: event.target.value })}
                placeholder="e.g. Product Manager"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Target company
              </span>
              <input
                value={form.targetCompany}
                onChange={(event) => update({ targetCompany: event.target.value })}
                placeholder="e.g. Infosys"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Key skills (comma-separated)
              </span>
              <input
                value={form.keySkills}
                onChange={(event) => update({ keySkills: event.target.value })}
                placeholder="SQL, stakeholder management"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Years of experience
              </span>
              <input
                value={form.yearsExperience}
                onChange={(event) => update({ yearsExperience: event.target.value })}
                placeholder="e.g. 5"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Career highlight
              </span>
              <textarea
                rows={2}
                value={form.highlight}
                onChange={(event) => update({ highlight: event.target.value })}
                placeholder="Led a project that increased conversion by 18%…"
                className="mt-1.5 w-full resize-y rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Interviewer name
              </span>
              <input
                value={form.interviewerName}
                onChange={(event) => update({ interviewerName: event.target.value })}
                placeholder="e.g. Ananya Patel"
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                Interview date
              </span>
              <input
                type="date"
                value={form.interviewDate}
                onChange={(event) => update({ interviewDate: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {COLD_EMAIL_TEMPLATE_META.map(({ id, title }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTemplate(id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    activeTemplate === id
                      ? 'border-sky-400 bg-canvas-elevated text-sky-800'
                      : 'border-canvas-border text-canvas-muted hover:bg-canvas-elevated'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-canvas-border bg-canvas-elevated p-4 font-sans text-xs leading-relaxed text-canvas-text">
              {templates[activeTemplate]}
            </pre>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-sky-700"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}

        {!embedded && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
            >
              Done
            </button>
          </div>
        )}
      </div>
  );

  if (embedded) return content;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-email-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {content}
    </div>
  );
}
