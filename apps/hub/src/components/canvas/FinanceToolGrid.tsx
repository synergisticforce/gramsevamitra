import type { FinanceToolCategory, FinanceToolId } from '../../config/financeCanvasTools';
import {
  FINANCE_CANVAS_TOOLS,
  FINANCE_CATEGORY_META,
  toolsByCategory,
} from '../../config/financeCanvasTools';

interface Props {
  onSelectTool: (toolId: FinanceToolId) => void;
}

const CATEGORY_ORDER: FinanceToolCategory[] = [
  'investment',
  'planning',
  'loans',
  'taxes',
  'business',
  'everyday',
  'international',
];

export default function FinanceToolGrid({ onSelectTool }: Props) {
  const grouped = toolsByCategory();

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const tools = grouped[category];
        if (tools.length === 0) return null;
        const meta = FINANCE_CATEGORY_META[category];

        return (
          <section key={category}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                {meta.label}
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">{meta.description}</p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <li key={tool.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTool(tool.id)}
                    className="group flex h-full w-full flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md active:scale-[0.98] sm:p-5"
                  >
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {tool.icon}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-slate-900 group-hover:text-emerald-800">
                        {tool.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
                    </div>
                    <span className="mt-auto text-xs font-semibold text-emerald-600">Open tool →</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
        {FINANCE_CANVAS_TOOLS.length} calculators · 100% client-side · your numbers stay on this device
      </p>
    </div>
  );
}
