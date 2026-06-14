/** Finance Hub workspace tool registry (Phase 7.1). */

export type FinanceToolCategory = 'investment' | 'loans' | 'taxes';

export type FinanceToolId = 'sip-calculator' | 'emi-calculator' | 'gst-calculator';

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
    description: 'Estimate EMIs and total interest on home and personal loans.',
  },
  taxes: {
    label: 'Taxes',
    description: 'Break down Indian GST for invoices and pricing.',
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
    id: 'gst-calculator',
    label: 'GST Calculator',
    icon: '🧾',
    category: 'taxes',
    description: 'Add or remove GST with CGST, SGST, and IGST splits.',
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
  };
  for (const tool of FINANCE_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}
