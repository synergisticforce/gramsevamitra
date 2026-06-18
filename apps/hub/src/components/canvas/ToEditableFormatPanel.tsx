import { useCallback, useState } from 'react';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import type { ProOperationId } from '../../lib/auth/creditCheck';
import type { EditableFormatTarget } from '../../lib/services/toEditableFormatPipeline';
import {
  EditableFormatProRequiredError,
  promptProUpgradeForComplexLayout,
  runProLayoutReconstruction,
  runToEditableFormatPipeline,
} from '../../lib/services/toEditableFormatPipeline';

interface Props {
  file: File;
  isPro: boolean;
  disabled?: boolean;
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
  { id: 'txt', label: 'Text File (.txt)' },
  { id: 'docx', label: 'Word Doc (.docx)' },
  { id: 'xlsx', label: 'Excel Spreadsheet (.xlsx)', proOnly: true },
];

function segmentClass(active: boolean, proOnly?: boolean): string {
  if (active) {
    return proOnly
      ? 'border-amber-500/70 bg-amber-950/50 text-amber-100'
      : 'border-canvas-accent bg-canvas-accent-soft text-canvas-text';
  }
  return proOnly
    ? 'border-amber-800/40 bg-canvas-elevated text-amber-100/80 hover:border-amber-500/50'
    : 'border-canvas-border bg-canvas-elevated text-canvas-muted hover:border-canvas-accent hover:text-canvas-text';
}

export default function ToEditableFormatPanel({
  file,
  isPro,
  disabled = false,
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

    if (target === 'xlsx' && !isPro) {
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
    if (target === 'xlsx' && isPro) {
      requestProConfirm('reconstruct-layout', 'Excel layout reconstruction', () => {
        void runConversion();
      });
      return;
    }
    void runConversion();
  }, [isPro, requestProConfirm, runConversion, target]);

  return (
    <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-3xl leading-none" aria-hidden="true">
            📝
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-canvas-text sm:text-lg">To Editable Format</h2>
              <span className="rounded-full bg-canvas-accent-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas-accent">
                Auto-Orchestrated
              </span>
            </div>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-300">
              One smart pipeline — native text, free local OCR, or Pro layout reconstruction.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy || disabled}
          onClick={handleConvertClick}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Converting…' : 'Convert & download'}
        </button>
      </div>

      <div
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        role="group"
        aria-label="Output format"
      >
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
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition sm:text-sm ${segmentClass(target === option.id, option.proOnly)}`}
          >
            {option.label}
            {option.proOnly && (
              <span className="ml-1.5 rounded bg-amber-900/60 px-1 py-0.5 text-[9px] font-bold uppercase text-amber-100">
                PRO
              </span>
            )}
          </button>
        ))}
      </div>

      {largeFileNote && (
        <p className="mt-3 rounded-xl border border-canvas-border bg-canvas-elevated px-3 py-2.5 text-xs font-medium leading-relaxed text-slate-200">
          Large file processing. Local conversion is completely free but will take a few minutes. Please
          keep this tab open or{' '}
          <button
            type="button"
            className="font-semibold text-canvas-accent underline-offset-2 hover:underline"
            onClick={() => openProUpgrade({
              featureId: 'reconstruct-layout',
              featureName: 'Pro Server Cloud Extraction',
              featureDescription: PRO_SPEEDUP_COPY,
            })}
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
