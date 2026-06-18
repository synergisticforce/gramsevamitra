import type { DocumentCanvasAction } from '../../config/documentCanvasActions';
import type { ProOperationId } from '../../lib/auth/creditCheck';
import ToEditableFormatPanel from './ToEditableFormatPanel';

interface Props {
  actions: DocumentCanvasAction[];
  onActionClick?: (actionId: string) => void;
  editableFile?: File | null;
  editableIsPro?: boolean;
  editableDisabled?: boolean;
  onEditableProcessingChange?: (active: boolean, label: string, percent: number, subtitle?: string) => void;
  onEditableSuccess?: (message: string) => void;
  onEditableError?: (message: string) => void;
  requestProConfirm?: (operationId: ProOperationId, label: string, onConfirm: () => void) => void;
}

export default function DocumentActionToolbar({
  actions,
  onActionClick,
  editableFile,
  editableIsPro = false,
  editableDisabled = false,
  onEditableProcessingChange,
  onEditableSuccess,
  onEditableError,
  requestProConfirm,
}: Props) {
  const showEditable = actions.some((action) => action.id === 'to-editable-format');
  const gridActions = actions.filter((action) => action.id !== 'to-editable-format');

  if (actions.length === 0) {
    return (
      <p className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-3 text-sm font-medium leading-relaxed text-slate-200">
        No actions available for this file type yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showEditable && editableFile && onEditableProcessingChange && onEditableSuccess && onEditableError && requestProConfirm && (
        <ToEditableFormatPanel
          file={editableFile}
          isPro={editableIsPro}
          disabled={editableDisabled}
          onProcessingChange={onEditableProcessingChange}
          onSuccess={onEditableSuccess}
          onError={onEditableError}
          requestProConfirm={requestProConfirm}
        />
      )}

      {gridActions.length > 0 && (
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-canvas-subtle">Actions</p>
              <p className="mt-0.5 text-sm font-medium text-canvas-text">Choose what to do with this file</p>
            </div>
            <span className="hidden text-xs font-medium leading-relaxed text-slate-300 sm:inline">
              Free tools run locally · Pro uses advanced AI
            </span>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {gridActions.map((action) => {
              const isPro = action.tier === 'pro';
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    onClick={() => onActionClick?.(action.id)}
                    className={`group relative flex w-full flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                      isPro
                        ? 'border-amber-700/40 bg-gradient-to-br from-amber-950/50 to-canvas-elevated hover:border-amber-500/60 hover:shadow-none'
                        : 'border-canvas-border bg-canvas-elevated hover:border-emerald-500/50 hover:bg-canvas-surface hover:shadow-none'
                    }`}
                  >
                    {isPro && (
                      <span className="absolute right-2 top-2 rounded-full bg-amber-900/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
                        ⚡ Pro
                      </span>
                    )}
                    {action.badge && !isPro && (
                      <span className="absolute right-2 top-2 rounded-full bg-canvas-accent-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-canvas-accent">
                        {action.badge}
                      </span>
                    )}
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {action.icon}
                    </span>
                    <span
                      className={`text-sm font-semibold ${isPro ? 'pr-10 text-amber-100' : action.badge ? 'pr-16 text-canvas-text' : 'text-canvas-text'}`}
                    >
                      {action.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
