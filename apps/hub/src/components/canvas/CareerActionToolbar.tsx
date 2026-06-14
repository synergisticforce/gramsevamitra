import type { CareerCanvasAction } from '../../config/careerCanvasActions';

interface Props {
  actions: CareerCanvasAction[];
  onActionClick?: (actionId: string) => void;
}

export default function CareerActionToolbar({ actions, onActionClick }: Props) {
  if (actions.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        No actions available for this file type yet.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Actions</p>
          <p className="mt-0.5 text-sm font-medium text-slate-800">Choose what to do with this document</p>
        </div>
        <span className="hidden text-xs text-slate-400 sm:inline">Free tools run locally · Pro uses serverless AI</span>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {actions.map((action) => {
          const isPro = action.tier === 'pro';
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onActionClick?.(action.id)}
                className={`group relative flex w-full flex-col items-start gap-2 rounded-xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                  isPro
                    ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white hover:border-amber-300 hover:shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-white hover:shadow-sm'
                }`}
              >
                {isPro && (
                  <span className="absolute right-2 top-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    ⚡ Pro
                  </span>
                )}
                <span className="text-2xl leading-none" aria-hidden="true">
                  {action.icon}
                </span>
                <span
                  className={`text-sm font-semibold ${isPro ? 'text-amber-950 pr-10' : 'text-slate-900'}`}
                >
                  {action.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
