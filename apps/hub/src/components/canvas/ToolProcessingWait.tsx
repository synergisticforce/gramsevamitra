import ProcessingSpinner from './ProcessingSpinner';

interface Props {
  /** Short task label shown under the main heading. */
  label?: string;
  className?: string;
}

/** Inline “please wait” block for tools and modals during heavy local work. */
export default function ToolProcessingWait({
  label = 'Working on your file…',
  className = '',
}: Props) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-canvas-border bg-canvas-elevated px-4 py-3 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ProcessingSpinner size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-canvas-text">Processing… Please wait</p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-300">{label}</p>
      </div>
    </div>
  );
}
