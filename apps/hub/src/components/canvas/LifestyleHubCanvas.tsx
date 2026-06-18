import { useCallback, useEffect, useState } from 'react';
import type { LifestyleToolId } from '../../config/lifestyleCanvasTools';
import { getLifestyleTool } from '../../config/lifestyleCanvasTools';
import {
  loadLifestyleActiveTool,
  saveLifestyleActiveTool,
} from '../../lib/canvas/lifestyleCanvasStorage';
import LifestyleAgeDateCalculator from './LifestyleAgeDateCalculator';
import LifestyleBmiCalculator from './LifestyleBmiCalculator';
import LifestyleBodyFatCalculator from './LifestyleBodyFatCalculator';
import LifestyleExamAgeCalculator from './LifestyleExamAgeCalculator';
import LifestyleMacroCalculator from './LifestyleMacroCalculator';
import LifestyleMenstrualCalculator from './LifestyleMenstrualCalculator';
import LifestyleMoodLog from './LifestyleMoodLog';
import LifestyleToolGrid from './LifestyleToolGrid';

type LifestyleView = 'grid' | LifestyleToolId;

function renderTool(toolId: LifestyleToolId) {
  switch (toolId) {
    case 'bmi-calculator':
      return <LifestyleBmiCalculator />;
    case 'body-fat-calculator':
      return <LifestyleBodyFatCalculator />;
    case 'macro-calorie-calculator':
      return <LifestyleMacroCalculator />;
    case 'age-date-calculator':
      return <LifestyleAgeDateCalculator />;
    case 'exam-age-calculator':
      return <LifestyleExamAgeCalculator />;
    case 'menstrual-calculator':
      return <LifestyleMenstrualCalculator />;
    case 'mood-daily-log':
      return <LifestyleMoodLog />;
    default:
      return null;
  }
}

export default function LifestyleHubCanvas() {
  const [view, setView] = useState<LifestyleView>('grid');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadLifestyleActiveTool();
    if (saved) setView(saved);
    setHydrated(true);
  }, []);

  const openTool = useCallback((toolId: LifestyleToolId) => {
    setView(toolId);
    saveLifestyleActiveTool(toolId);
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    saveLifestyleActiveTool(null);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
        <p className="text-sm font-medium leading-relaxed text-slate-200">Loading Health & Lifestyle…</p>
      </div>
    );
  }

  const activeTool = view !== 'grid' ? getLifestyleTool(view) : null;

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              🧘
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Health & Lifestyle</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                7 private wellness calculators and trackers — BMI, macros, exam age checks, cycle predictions,
                and mood journaling. All offline.
              </p>
            </div>
          </div>
        </header>

        {view === 'grid' ? (
          <LifestyleToolGrid onSelectTool={openTool} />
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={backToGrid}
              className="inline-flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-none transition hover:border-violet-300 hover:bg-canvas-elevated hover:text-white"
            >
              <span aria-hidden="true">←</span> Back to Tools
            </button>

            {activeTool && (
              <div className="rounded-2xl border border-canvas-border bg-canvas-elevated/50 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {activeTool.icon}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-white">{activeTool.label}</h2>
                    <p className="text-sm font-medium leading-relaxed text-slate-200">{activeTool.description}</p>
                  </div>
                </div>
                {renderTool(view)}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
