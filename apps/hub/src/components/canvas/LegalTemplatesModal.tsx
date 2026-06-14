import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildLegalTemplateText,
  copyLegalTemplateText,
  getLegalTemplateDef,
  LEGAL_TEMPLATE_DEFS,
  loadLegalTemplateState,
  saveLegalTemplateState,
  type LegalTemplateId,
  type LegalTemplateValues,
} from '../../lib/canvas/careerLegalTemplates';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function LegalTemplatesModal({ onClose, onSuccess }: Props) {
  const [templateId, setTemplateId] = useState<LegalTemplateId>('nda');
  const [values, setValues] = useState<LegalTemplateValues>({});
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = loadLegalTemplateState();
    setTemplateId(saved.templateId);
    setValues(saved.values);
  }, []);

  const templateDef = useMemo(
    () => getLegalTemplateDef(templateId) ?? LEGAL_TEMPLATE_DEFS[0],
    [templateId]
  );

  const documentText = useMemo(
    () => buildLegalTemplateText(templateId, values),
    [templateId, values]
  );

  const updateValue = useCallback(
    (key: string, value: string) => {
      setValues((prev) => {
        const next = { ...prev, [key]: value };
        saveLegalTemplateState(templateId, next);
        return next;
      });
      setError(null);
    },
    [templateId]
  );

  const handleTemplateChange = useCallback((id: LegalTemplateId) => {
    setTemplateId(id);
    const saved = loadLegalTemplateState();
    const nextValues = saved.templateId === id ? saved.values : {};
    setValues(nextValues);
    saveLegalTemplateState(id, nextValues);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await copyLegalTemplateText(documentText);
      setCopied(true);
      onSuccess(`${templateDef.label} copied to clipboard.`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Check browser permissions.');
    }
  }, [documentText, onSuccess, templateDef.label]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-templates-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="legal-templates-title" className="text-lg font-bold text-slate-900">
              📜 Legal &amp; Employment Templates
            </h2>
            <p className="mt-1 text-sm text-slate-500">{templateDef.description}</p>
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

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {templateDef.disclaimer}
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Document type
          </span>
          <select
            value={templateId}
            onChange={(event) => handleTemplateChange(event.target.value as LegalTemplateId)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            {LEGAL_TEMPLATE_DEFS.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {templateDef.fields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {field.label}
                </span>
                {field.multiline ? (
                  <textarea
                    rows={2}
                    value={values[field.key] ?? ''}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                ) : (
                  <input
                    value={values[field.key] ?? ''}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                  />
                )}
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live preview
            </p>
            <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-sans text-[11px] leading-relaxed text-slate-800">
              {documentText}
            </pre>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
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
