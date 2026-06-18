import { useCallback, useEffect, useState } from 'react';
import type { FinanceToolId } from '../../config/financeCanvasTools';
import { getFinanceTool } from '../../config/financeCanvasTools';
import {
  loadFinanceActiveTool,
  saveFinanceActiveTool,
} from '../../lib/canvas/financeCanvasStorage';
import FinanceCryptoGainsCalculator from './FinanceCryptoGainsCalculator';
import FinanceCurrencyConverter from './FinanceCurrencyConverter';
import FinanceDiscountMarginCalculator from './FinanceDiscountMarginCalculator';
import FinanceEmiCalculator from './FinanceEmiCalculator';
import FinanceEnvelopeBudgetPlanner from './FinanceEnvelopeBudgetPlanner';
import FinanceGigIncomeTracker from './FinanceGigIncomeTracker';
import FinanceGstCalculator from './FinanceGstCalculator';
import FinanceInvoiceBuilder from './FinanceInvoiceBuilder';
import FinanceLoanRepaymentCalculator from './FinanceLoanRepaymentCalculator';
import FinanceMeetingCostCalculator from './FinanceMeetingCostCalculator';
import FinancePayStubGenerator from './FinancePayStubGenerator';
import FinanceSalaryBenchmark from './FinanceSalaryBenchmark';
import FinanceSalaryCalculator from './FinanceSalaryCalculator';
import FinanceSipCalculator from './FinanceSipCalculator';
import FinanceTaxDeductionCalculator from './FinanceTaxDeductionCalculator';
import FinanceTipSplitCalculator from './FinanceTipSplitCalculator';
import FinanceToolGrid from './FinanceToolGrid';

type FinanceView = 'grid' | FinanceToolId;

function renderTool(toolId: FinanceToolId) {
  switch (toolId) {
    case 'sip-calculator':
      return <FinanceSipCalculator />;
    case 'emi-calculator':
      return <FinanceEmiCalculator />;
    case 'gst-calculator':
      return <FinanceGstCalculator />;
    case 'discount-margin-calculator':
      return <FinanceDiscountMarginCalculator />;
    case 'loan-repayment-calculator':
      return <FinanceLoanRepaymentCalculator />;
    case 'tip-split-calculator':
      return <FinanceTipSplitCalculator />;
    case 'meeting-cost-calculator':
      return <FinanceMeetingCostCalculator />;
    case 'tax-deduction-calculator':
      return <FinanceTaxDeductionCalculator />;
    case 'currency-converter':
      return <FinanceCurrencyConverter />;
    case 'invoice-builder':
      return <FinanceInvoiceBuilder />;
    case 'pay-stub-generator':
      return <FinancePayStubGenerator />;
    case 'crypto-gains-calculator':
      return <FinanceCryptoGainsCalculator />;
    case 'envelope-budget-planner':
      return <FinanceEnvelopeBudgetPlanner />;
    case 'gig-income-tracker':
      return <FinanceGigIncomeTracker />;
    case 'salary-calculator':
      return <FinanceSalaryCalculator />;
    case 'salary-benchmarking':
      return <FinanceSalaryBenchmark />;
    default:
      return null;
  }
}

export default function FinanceHubCanvas() {
  const [view, setView] = useState<FinanceView>('grid');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadFinanceActiveTool();
    if (saved) setView(saved);
    setHydrated(true);
  }, []);

  const openTool = useCallback((toolId: FinanceToolId) => {
    setView(toolId);
    saveFinanceActiveTool(toolId);
  }, []);

  const backToGrid = useCallback(() => {
    setView('grid');
    saveFinanceActiveTool(null);
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[280px] items-center justify-center px-4 py-12">
        <p className="text-sm font-medium leading-relaxed text-slate-200">Loading Finance Hub…</p>
      </div>
    );
  }

  const activeTool = view !== 'grid' ? getFinanceTool(view) : null;

  return (
    <section className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Workspace</p>
          <div className="mt-2 flex items-start gap-3">
            <span className="text-3xl" aria-hidden="true">
              💰
            </span>
            <div>
              <h1 className="text-2xl font-bold text-canvas-text sm:text-3xl">Finance Hub</h1>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
                EMI, SIP, GST, salary tools, invoices, crypto gains, budgeting, and 16 client-side money tools.
              </p>
            </div>
          </div>
        </header>

        {view === 'grid' ? (
          <FinanceToolGrid onSelectTool={openTool} />
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={backToGrid}
              className="inline-flex items-center gap-2 rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-canvas-muted shadow-none transition hover:border-emerald-300 hover:bg-canvas-accent-soft hover:text-canvas-accent"
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
                    <h2 className="text-lg font-bold text-canvas-text">{activeTool.label}</h2>
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
