export default function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/90 to-yellow-500/80 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950 shadow-sm ${className}`}
      title="GramSeva Mitra Pro"
      aria-label="Pro subscriber"
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3 w-3 fill-current"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M8 1.2 9.7 5.4l4.6.4-3.5 3 1.1 4.5L8 11.4l-3.9 2 1.1-4.5-3.5-3 4.6-.4L8 1.2z" />
      </svg>
      Pro
    </span>
  );
}
