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
      className="fixed inset-0 z-[65] flex items-end justify-center bg-canvas-accent-muted/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-templates-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="legal-templates-title" className="text-lg font-bold text-canvas-text">
              📜 Legal &amp; Employment Templates
            </h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">{templateDef.description}</p>
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

        <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-elevated px-3 py-2 text-xs text-slate-200">
          {templateDef.disclaimer}
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
            Document type
          </span>
          <select
            value={templateId}
            onChange={(event) => handleTemplateChange(event.target.value as LegalTemplateId)}
            className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
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
                <span className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
                  {field.label}
                </span>
                {field.multiline ? (
                  <textarea
                    rows={2}
                    value={values[field.key] ?? ''}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full resize-y rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
                  />
                ) : (
                  <input
                    value={values[field.key] ?? ''}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    className="mt-1.5 w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm"
                  />
                )}
              </label>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-canvas-subtle">
              Live preview
            </p>
            <pre className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-canvas-border bg-canvas-elevated p-4 font-sans text-[11px] leading-relaxed text-canvas-text">
              {documentText}
            </pre>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-sky-700"
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

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-canvas-border px-4 py-2.5 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
