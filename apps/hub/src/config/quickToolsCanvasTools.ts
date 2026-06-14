/** Quick Tools workspace registry (Phase 8.1 + Phase 4 migration). */

export type QuickToolCategory =
  | 'generators'
  | 'converters'
  | 'math'
  | 'developer';

export type QuickToolId =
  | 'qr-generator'
  | 'password-generator'
  | 'unit-converter'
  | 'percentage-calculator'
  | 'scientific-calculator'
  | 'base64-encoder'
  | 'url-encoder'
  | 'hash-generator';

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
  math: {
    label: 'Math',
    description: 'Percentage math and a full scientific calculator keypad.',
  },
  developer: {
    label: 'Developer',
    description: 'Base64, URL encoding, and cryptographic hash digests.',
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
  {
    id: 'percentage-calculator',
    label: 'Percentage Calculator',
    icon: '％',
    category: 'math',
    description: 'Find X% of Y, compare values, and calculate percent change.',
  },
  {
    id: 'scientific-calculator',
    label: 'Scientific Calculator',
    icon: '🧮',
    category: 'math',
    description: 'Trig, powers, and expression history with a responsive keypad.',
  },
  {
    id: 'base64-encoder',
    label: 'Base64 Encoder',
    icon: '🔤',
    category: 'developer',
    description: 'Encode or decode UTF-8 text to Base64 instantly.',
  },
  {
    id: 'url-encoder',
    label: 'URL Encoder',
    icon: '🌐',
    category: 'developer',
    description: 'Encode or decode URI components with live output.',
  },
  {
    id: 'hash-generator',
    label: 'Hash Generator',
    icon: '#️⃣',
    category: 'developer',
    description: 'Compute MD5 and SHA-256 digests locally as you type.',
  },
];

export function getQuickTool(id: QuickToolId): QuickCanvasTool | undefined {
  return QUICK_CANVAS_TOOLS.find((tool) => tool.id === id);
}

export function quickToolsByCategory(): Record<QuickToolCategory, QuickCanvasTool[]> {
  const grouped: Record<QuickToolCategory, QuickCanvasTool[]> = {
    generators: [],
    converters: [],
    math: [],
    developer: [],
  };
  for (const tool of QUICK_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export const QUICK_TOOL_IDS: QuickToolId[] = QUICK_CANVAS_TOOLS.map((t) => t.id);

export function isQuickToolId(value: string): value is QuickToolId {
  return QUICK_TOOL_IDS.includes(value as QuickToolId);
}
