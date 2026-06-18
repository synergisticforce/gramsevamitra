/** Finance Hub workspace tool registry (Phase 7.1 + Phase 4 migration). */

export type FinanceToolCategory =
  | 'investment'
  | 'loans'
  | 'taxes'
  | 'business'
  | 'everyday'
  | 'international'
  | 'planning';

export type FinanceToolId =
  | 'sip-calculator'
  | 'emi-calculator'
  | 'gst-calculator'
  | 'discount-margin-calculator'
  | 'loan-repayment-calculator'
  | 'tip-split-calculator'
  | 'meeting-cost-calculator'
  | 'tax-deduction-calculator'
  | 'currency-converter'
  | 'invoice-builder'
  | 'pay-stub-generator'
  | 'crypto-gains-calculator'
  | 'envelope-budget-planner'
  | 'gig-income-tracker'
  | 'salary-calculator'
  | 'salary-benchmarking';

export interface FinanceCanvasTool {
  id: FinanceToolId;
  label: string;
  icon: string;
  category: FinanceToolCategory;
  description: string;
}

export const FINANCE_CATEGORY_META: Record<
  FinanceToolCategory,
  { label: string; description: string }
> = {
  investment: {
    label: 'Investment',
    description: 'Plan long-term wealth with mutual fund projections.',
  },
  loans: {
    label: 'Loans',
    description: 'Estimate EMIs, prepayments, and total interest on loans.',
  },
  taxes: {
    label: 'Taxes',
    description: 'GST breakdowns and income-tax deduction estimates.',
  },
  business: {
    label: 'Business',
    description: 'Pricing, margins, and meeting productivity costs.',
  },
  everyday: {
    label: 'Everyday',
    description: 'Tips, splits, and quick money math for daily use.',
  },
  international: {
    label: 'International',
    description: 'Live currency conversion with offline rate cache.',
  },
  planning: {
    label: 'Planning',
    description: 'Budget envelopes, gig income, and crypto portfolio tracking.',
  },
};

export const FINANCE_CANVAS_TOOLS: FinanceCanvasTool[] = [
  {
    id: 'sip-calculator',
    label: 'SIP Calculator',
    icon: '📈',
    category: 'investment',
    description: 'Project SIP maturity, invested amount, and wealth gained.',
  },
  {
    id: 'emi-calculator',
    label: 'EMI Calculator',
    icon: '🏦',
    category: 'loans',
    description: 'Compute monthly EMI with principal vs. interest breakdown.',
  },
  {
    id: 'loan-repayment-calculator',
    label: 'Loan Repayment',
    icon: '📉',
    category: 'loans',
    description: 'Plan prepayments and see principal vs. interest over time.',
  },
  {
    id: 'gst-calculator',
    label: 'GST Calculator',
    icon: '🧾',
    category: 'taxes',
    description: 'Add or remove GST with CGST, SGST, and IGST splits.',
  },
  {
    id: 'tax-deduction-calculator',
    label: 'Tax Deductions',
    icon: '📋',
    category: 'taxes',
    description: 'Estimate tax savings from 80C, 80D, HRA, and other deductions.',
  },
  {
    id: 'discount-margin-calculator',
    label: 'Discount & Margin',
    icon: '🏷️',
    category: 'business',
    description: 'Calculate sale discounts, tax, margin %, and markup in one place.',
  },
  {
    id: 'meeting-cost-calculator',
    label: 'Meeting Cost',
    icon: '⏱️',
    category: 'business',
    description: 'Estimate rupee cost of meetings by attendee hourly rates.',
  },
  {
    id: 'tip-split-calculator',
    label: 'Tip & Split',
    icon: '🍽️',
    category: 'everyday',
    description: 'Split restaurant bills with adjustable tip percentages.',
  },
  {
    id: 'currency-converter',
    label: 'Currency Converter',
    icon: '💱',
    category: 'international',
    description: 'Convert 160+ currencies with live rates and offline cache.',
  },
  {
    id: 'invoice-builder',
    label: 'Invoice Builder',
    icon: '📄',
    category: 'business',
    description: 'Build invoices with live preview and export a clean PDF.',
  },
  {
    id: 'pay-stub-generator',
    label: 'Pay Stub Generator',
    icon: '💼',
    category: 'business',
    description: 'Generate pay stubs with earnings, deductions, and PDF export.',
  },
  {
    id: 'crypto-gains-calculator',
    label: 'Crypto Gains',
    icon: '₿',
    category: 'investment',
    description: 'Track trades with FIFO capital gains and portfolio charts.',
  },
  {
    id: 'envelope-budget-planner',
    label: 'Envelope Budget',
    icon: '✉️',
    category: 'planning',
    description: 'Zero-based envelope budgeting with budget vs. actual charts.',
  },
  {
    id: 'gig-income-tracker',
    label: 'Gig Income Tracker',
    icon: '🛵',
    category: 'planning',
    description: 'Log freelance income with monthly and category breakdowns.',
  },
  {
    id: 'salary-calculator',
    label: 'Salary Calculator',
    icon: '💰',
    category: 'planning',
    description: 'Estimate monthly in-hand pay from CTC with EPF and tax deductions.',
  },
  {
    id: 'salary-benchmarking',
    label: 'Salary Benchmarking',
    icon: '📊',
    category: 'planning',
    description: 'Compare your role against regional salary benchmarks across India.',
  },
];

export function getFinanceTool(id: FinanceToolId): FinanceCanvasTool | undefined {
  return FINANCE_CANVAS_TOOLS.find((tool) => tool.id === id);
}

export function toolsByCategory(): Record<FinanceToolCategory, FinanceCanvasTool[]> {
  const grouped: Record<FinanceToolCategory, FinanceCanvasTool[]> = {
    investment: [],
    loans: [],
    taxes: [],
    business: [],
    everyday: [],
    international: [],
    planning: [],
  };
  for (const tool of FINANCE_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export const FINANCE_TOOL_IDS: FinanceToolId[] = FINANCE_CANVAS_TOOLS.map((t) => t.id);

export function isFinanceToolId(value: string): value is FinanceToolId {
  return FINANCE_TOOL_IDS.includes(value as FinanceToolId);
}
