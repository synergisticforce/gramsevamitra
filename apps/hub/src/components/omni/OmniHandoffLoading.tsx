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
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-canvas-border border-t-violet-600"
        aria-hidden="true"
      />
      <p className="max-w-sm text-center text-sm font-medium text-canvas-muted">{label}</p>
      <p className="max-w-sm text-center text-xs text-canvas-subtle">
        Your file stays in browser memory — nothing is uploaded to our servers.
      </p>
    </div>
  );
}
