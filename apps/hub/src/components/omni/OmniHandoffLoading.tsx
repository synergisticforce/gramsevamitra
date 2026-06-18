import ProcessingSpinner from '../canvas/ProcessingSpinner';

interface Props {
  label?: string;
}

export default function OmniHandoffLoading({
  label = 'Loading your file into the workspace…',
}: Props) {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-4 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ProcessingSpinner size="lg" />
      <p className="max-w-sm text-center text-sm font-semibold text-canvas-text">Processing… Please wait</p>
      <p className="max-w-sm text-center text-sm font-medium text-canvas-muted">{label}</p>
      <p className="max-w-sm text-center text-xs font-medium leading-relaxed text-slate-300">
        Your file stays in browser memory — nothing is uploaded to our servers.
      </p>
    </div>
  );
}
