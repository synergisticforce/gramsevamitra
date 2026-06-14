import { useCallback, useEffect, useState } from 'react';
import type { QuickToolId } from '../../config/quickToolsCanvasTools';
import { getQuickTool } from '../../config/quickToolsCanvasTools';
import {
  loadQuickActiveTool,
  saveQuickActiveTool,
} from '../../lib/canvas/quickToolsCanvasStorage';
import CanvasToast from './CanvasToast';
import QuickBabyNameGenerator from './QuickBabyNameGenerator';
import QuickBase64Tool from './QuickBase64Tool';
import QuickColorPalette from './QuickColorPalette';
import QuickDecisionWheel from './QuickDecisionWheel';
import QuickHashGenerator from './QuickHashGenerator';
import QuickPasswordGenerator from './QuickPasswordGenerator';
import QuickPercentageCalculator from './QuickPercentageCalculator';
import QuickQrGenerator from './QuickQrGenerator';
import QuickRecipeScaler from './QuickRecipeScaler';
import QuickScientificCalculator from './QuickScientificCalculator';
import QuickSeoMetaGenerator from './QuickSeoMetaGenerator';
import QuickToolsToolGrid from './QuickToolsToolGrid';
import QuickUnitConverter from './QuickUnitConverter';
import QuickUrlEncoder from './QuickUrlEncoder';

type QuickView = 'grid' | QuickToolId;

function renderTool(toolId: QuickToolId, onToast: (message: string) => void) {
  switch (toolId) {
    case 'qr-generator':
      return <QuickQrGenerator />;
    case 'password-generator':
      return <QuickPasswordGenerator onToast={onToast} />;
    case 'unit-converter':
      return <QuickUnitConverter />;
    case 'percentage-calculator':
      return <QuickPercentageCalculator />;
    case 'scientific-calculator':
      return <QuickScientificCalculator />;
    case 'base64-encoder':
      return <QuickBase64Tool onToast={onToast} />;
    case 'url-encoder':
      return <QuickUrlEncoder onToast={onToast} />;
    case 'hash-generator':
      return <QuickHashGenerator onToast={onToast} />;
    case 'color-palette':
      return <QuickColorPalette onToast={onToast} />;
    case 'decision-wheel':
      return <QuickDecisionWheel />;
    case 'seo-meta-generator':
      return <QuickSeoMetaGenerator onToast={onToast} />;
    case 'recipe-scaler':
      return <QuickRecipeScaler />;
    case 'baby-name-generator':
      return <QuickBabyNameGenerator />;
    default:
      return null;
  }
}

export default function QuickToolsHubCanvas() {
  const [view, setView] = useState<QuickView>('grid');
  const [hydrated, setHydrated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToastMessage(null), []);

  useEffect(() => {
    const saved = loadQuickActiveTool();
    if (saved) setView(saved);
    setHydrated(true);
  }, []);

  const openTool = useCallback((toolId: QuickToolId) => {
    setView(toolId);
    saveQuickActiveTool(toolId);
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    saveQuickActiveTool(null);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
        <p className="text-sm text-slate-500">Loading Quick Tools…</p>
      </div>
    );
  }

  const activeTool = view !== 'grid' ? getQuickTool(view) : null;

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              ⚡
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Quick Tools</h1>
              <p className="mt-1 text-sm text-slate-600">
                Calculators, encoders, color palettes, SEO tags, and 13 instant utilities — all offline.
              </p>
            </div>
          </div>
        </header>

        {view === 'grid' ? (
          <QuickToolsToolGrid onSelectTool={openTool} />
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={backToGrid}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
            >
              <span aria-hidden="true">←</span> Back to Tools
            </button>

            {activeTool && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">
                    {activeTool.icon}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{activeTool.label}</h2>
                    <p className="text-sm text-slate-500">{activeTool.description}</p>
                  </div>
                </div>
                {renderTool(view, setToastMessage)}
              </div>
            )}
          </div>
        )}
      </div>

      <CanvasToast message={toastMessage} onDismiss={dismissToast} />
    </section>
  );
}
