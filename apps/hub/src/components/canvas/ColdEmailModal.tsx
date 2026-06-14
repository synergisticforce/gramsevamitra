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
}

export default function ColdEmailModal({ onClose, onSuccess }: Props) {
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

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cold-email-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="cold-email-title" className="text-lg font-bold text-slate-900">
              ✉️ Cold Email Builder
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Outreach, interview follow-up &amp; thank-you templates — nothing leaves your device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your name
              </span>
              <input
                value={form.userName}
                onChange={(event) => update({ userName: event.target.value })}
                placeholder="e.g. Priya Sharma"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target role
              </span>
              <input
                value={form.targetRole}
                onChange={(event) => update({ targetRole: event.target.value })}
                placeholder="e.g. Product Manager"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target company
              </span>
              <input
                value={form.targetCompany}
                onChange={(event) => update({ targetCompany: event.target.value })}
                placeholder="e.g. Infosys"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Key skills (comma-separated)
              </span>
              <input
                value={form.keySkills}
                onChange={(event) => update({ keySkills: event.target.value })}
                placeholder="SQL, stakeholder management"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Years of experience
              </span>
              <input
                value={form.yearsExperience}
                onChange={(event) => update({ yearsExperience: event.target.value })}
                placeholder="e.g. 5"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Career highlight
              </span>
              <textarea
                rows={2}
                value={form.highlight}
                onChange={(event) => update({ highlight: event.target.value })}
                placeholder="Led a project that increased conversion by 18%…"
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Interviewer name
              </span>
              <input
                value={form.interviewerName}
                onChange={(event) => update({ interviewerName: event.target.value })}
                placeholder="e.g. Ananya Patel"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Interview date
              </span>
              <input
                type="date"
                value={form.interviewDate}
                onChange={(event) => update({ interviewDate: event.target.value })}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
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
                      ? 'border-sky-400 bg-sky-50 text-sky-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-800">
              {templates[activeTemplate]}
            </pre>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
