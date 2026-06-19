import { useCallback, useState } from 'react';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import type { ProOperationId } from '../../lib/auth/creditCheck';
import type { EditableFormatTarget } from '../../lib/services/toEditableFormatPipeline';
import {
  EditableFormatProRequiredError,
  isProStructuralFormat,
  promptProUpgradeForComplexLayout,
  runProLayoutReconstruction,
  runToEditableFormatPipeline,
} from '../../lib/services/toEditableFormatPipeline';

interface Props {
  file: File;
  isPro: boolean;
  disabled?: boolean;
  badge?: string;
  onProcessingChange: (active: boolean, label: string, percent: number, subtitle?: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  requestProConfirm: (operationId: ProOperationId, label: string, onConfirm: () => void) => void;
}

const FORMAT_OPTIONS: Array<{
  id: EditableFormatTarget;
  label: string;
  proOnly?: boolean;
}> = [
  { id: 'txt', label: '.txt' },
  { id: 'md', label: '.md' },
  { id: 'docx', label: '.docx' },
  { id: 'xlsx', label: '.xlsx', proOnly: true },
  { id: 'csv', label: '.csv', proOnly: true },
  { id: 'xml', label: '.xml', proOnly: true },
];

function segmentClass(active: boolean, proOnly?: boolean): string {
  if (active) {
    return proOnly
      ? 'border-amber-500/70 bg-amber-950/50 text-amber-100'
      : 'border-canvas-accent bg-canvas-accent-soft text-canvas-text';
  }
  return proOnly
    ? 'border-amber-800/40 bg-canvas-surface text-amber-100/80 hover:border-amber-500/50'
    : 'border-canvas-border bg-canvas-surface text-canvas-muted hover:border-emerald-500/50 hover:text-canvas-text';
}

export default function ToEditableFormatPanel({
  file,
  isPro,
  disabled = false,
  badge = 'Auto-Orchestrated',
  onProcessingChange,
  onSuccess,
  onError,
  requestProConfirm,
}: Props) {
  const [target, setTarget] = useState<EditableFormatTarget>('docx');
  const [busy, setBusy] = useState(false);
  const [largeFileNote, setLargeFileNote] = useState(false);

  const runConversion = useCallback(async () => {
    if (busy || disabled) return;

    if (isProStructuralFormat(target) && !isPro) {
      promptProUpgradeForComplexLayout();
      return;
    }

    setBusy(true);
    setLargeFileNote(false);
    onProcessingChange(true, 'Starting To Editable Format…', 2);

    try {
      const result = await runToEditableFormatPipeline(file, target, {
        isPro,
        autoPromptPro: true,
        onLargeFileNotice: setLargeFileNote,
        onProgress: ({ label, percent, subtitle }) => {
          onProcessingChange(true, label, percent, subtitle);
        },
      });
      onProcessingChange(false, '', 0);
      onSuccess(`To Editable Format complete — ${result.fileName} downloaded.`);
    } catch (err) {
      onProcessingChange(false, '', 0);
      if (err instanceof EditableFormatProRequiredError && isPro) {
        try {
          const proResult = await runProLayoutReconstruction(file, target, ({ label, percent, subtitle }) => {
            onProcessingChange(true, label, percent, subtitle);
          });
          onProcessingChange(false, '', 0);
          onSuccess(`Pro layout reconstruction complete — ${proResult.fileName} downloaded.`);
        } catch (proErr) {
          onProcessingChange(false, '', 0);
          onError(proErr instanceof Error ? proErr.message : 'Pro reconstruction failed.');
        }
        return;
      }
      if (!(err instanceof EditableFormatProRequiredError)) {
        onError(err instanceof Error ? err.message : 'Conversion failed.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, disabled, file, isPro, onError, onProcessingChange, onSuccess, target]);

  const handleConvertClick = useCallback(() => {
    if (isProStructuralFormat(target) && isPro) {
      const label =
        target === 'xlsx'
          ? 'Excel layout reconstruction'
          : target === 'csv'
            ? 'CSV matrix reconstruction'
            : 'XML structure reconstruction';
      requestProConfirm('reconstruct-layout', label, () => {
        void runConversion();
      });
      return;
    }
    void runConversion();
  }, [isPro, requestProConfirm, runConversion, target]);

  return (
    <div className="group relative flex w-full flex-col items-start gap-3 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-3 text-left transition hover:border-emerald-500/50 hover:bg-canvas-surface">
      <span className="absolute right-2 top-2 rounded-full bg-canvas-accent-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-canvas-accent">
        {badge}
      </span>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 pr-16">
          <span className="text-2xl leading-none" aria-hidden="true">
            📝
          </span>
          <div>
            <span className="text-sm font-semibold text-canvas-text">To Editable Format</span>
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">
              Plain text &amp; Markdown free · Word smart-routed · spreadsheets Pro
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={handleConvertClick}
          className="inline-flex shrink-0 items-center justify-center rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2 text-xs font-semibold text-canvas-text transition hover:border-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        >
          {busy ? 'Converting…' : 'Convert & download'}
        </button>
      </div>

      <div className="flex w-full flex-wrap gap-2" role="group" aria-label="Output format">
        {FORMAT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              if (option.proOnly && !isPro) {
                promptProUpgradeForComplexLayout();
                return;
              }
              setTarget(option.id);
            }}
            className={`rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${segmentClass(target === option.id, option.proOnly)}`}
          >
            {option.label}
            {option.proOnly && (
              <span className="ml-1 rounded bg-amber-900/60 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-100">
                Pro
              </span>
            )}
          </button>
        ))}
      </div>

      {largeFileNote && (
        <p className="w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-200">
          Large file processing. Local conversion is completely free but will take a few minutes. Please
          keep this tab open or{' '}
          <button
            type="button"
            className="font-semibold text-canvas-accent underline-offset-2 hover:underline"
            onClick={() =>
              openProUpgrade({
                featureId: 'reconstruct-layout',
                featureName: 'Pro Server Cloud Extraction',
                featureDescription: PRO_SPEEDUP_COPY,
              })
            }
          >
            ⚡ Speed up instantly with Pro Server Cloud Extraction
          </button>
          .
        </p>
      )}
    </div>
  );
}

const PRO_SPEEDUP_COPY =
  'Skip the wait — Pro cloud layout reconstruction preserves tables and columns while processing large scans faster on secure serverless infrastructure.';
