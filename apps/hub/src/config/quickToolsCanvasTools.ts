/** Quick Tools workspace registry (Phase 8.1). */

export type QuickToolCategory = 'generators' | 'converters' | 'calculators';

export type QuickToolId = 'qr-generator' | 'password-generator' | 'unit-converter';

export interface QuickCanvasTool {
  id: QuickToolId;
  label: string;
  icon: string;
  category: QuickToolCategory;
  description: string;
}

export const QUICK_CATEGORY_META: Record<
  QuickToolCategory,
  { label: string; description: string }
> = {
  generators: {
    label: 'Generators',
    description: 'Create QR codes and secure passwords instantly.',
  },
  converters: {
    label: 'Converters',
    description: 'Convert between common units without leaving the page.',
  },
  calculators: {
    label: 'Calculators',
    description: 'Quick math utilities — more tools shipping soon.',
  },
};

export const QUICK_CANVAS_TOOLS: QuickCanvasTool[] = [
  {
    id: 'qr-generator',
    label: 'QR Code Generator',
    icon: '🔗',
    category: 'generators',
    description: 'Encode URLs or text to a scannable QR code with PNG download.',
  },
  {
    id: 'password-generator',
    label: 'Password Generator',
    icon: '🔐',
    category: 'generators',
    description: 'Generate cryptographically random passwords with custom rules.',
  },
  {
    id: 'unit-converter',
    label: 'Unit Converter',
    icon: '📏',
    category: 'converters',
    description: 'Two-way conversion for length, weight, and temperature.',
  },
];

export function getQuickTool(id: QuickToolId): QuickCanvasTool | undefined {
  return QUICK_CANVAS_TOOLS.find((tool) => tool.id === id);
}

export function quickToolsByCategory(): Record<QuickToolCategory, QuickCanvasTool[]> {
  const grouped: Record<QuickToolCategory, QuickCanvasTool[]> = {
    generators: [],
    converters: [],
    calculators: [],
  };
  for (const tool of QUICK_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}
