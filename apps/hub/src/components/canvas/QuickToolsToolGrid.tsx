import type { QuickToolCategory, QuickToolId } from '../../config/quickToolsCanvasTools';
import {
  QUICK_CANVAS_TOOLS,
  QUICK_CATEGORY_META,
  quickToolsByCategory,
} from '../../config/quickToolsCanvasTools';

interface Props {
  onSelectTool: (toolId: QuickToolId) => void;
}

const CATEGORY_ORDER: QuickToolCategory[] = ['generators', 'converters', 'math', 'developer'];

export default function QuickToolsToolGrid({ onSelectTool }: Props) {
  const grouped = quickToolsByCategory();

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const tools = grouped[category];
        if (tools.length === 0) return null;
        const meta = QUICK_CATEGORY_META[category];

        return (
          <section key={category}>
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-700">
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
                    className="group flex h-full w-full flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md active:scale-[0.98] sm:p-5"
                  >
                    <span className="text-3xl leading-none" aria-hidden="true">
                      {tool.icon}
                    </span>
                    <div>
                      <p className="text-base font-semibold text-slate-900 group-hover:text-violet-800">
                        {tool.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
                    </div>
                    <span className="mt-auto text-xs font-semibold text-violet-600">Open tool →</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
        {QUICK_CANVAS_TOOLS.length} utilities · 100% client-side · instant, offline responses
      </p>
    </div>
  );
}
