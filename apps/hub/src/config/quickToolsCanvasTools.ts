/** Quick Tools workspace registry (Phase 8.1 + Phase 4 migration). */

export type QuickToolCategory =
  | 'generators'
  | 'converters'
  | 'math'
  | 'developer'
  | 'design'
  | 'web'
  | 'lifestyle'
  | 'home-diy';

export type QuickToolId =
  | 'qr-generator'
  | 'password-generator'
  | 'unit-converter'
  | 'percentage-calculator'
  | 'scientific-calculator'
  | 'base64-encoder'
  | 'url-encoder'
  | 'hash-generator'
  | 'color-palette'
  | 'decision-wheel'
  | 'seo-meta-generator'
  | 'recipe-scaler'
  | 'baby-name-generator'
  | 'pet-care-scheduler'
  | 'garden-planting-planner'
  | 'construction-estimator'
  | 'renovation-budgeter';

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
  design: {
    label: 'Design',
    description: 'Color harmonies and visual creative utilities.',
  },
  web: {
    label: 'Web',
    description: 'SEO snippets and shareable meta tag generators.',
  },
  lifestyle: {
    label: 'Lifestyle',
    description: 'Pets, gardens, recipes, baby names, and everyday planning tools.',
  },
  'home-diy': {
    label: 'Home & DIY',
    description: 'Construction estimates and room-by-room renovation budgets.',
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
  {
    id: 'color-palette',
    label: 'Color Palette',
    icon: '🎨',
    category: 'design',
    description: 'Generate complementary, analogous, and triadic swatches from a base hex.',
  },
  {
    id: 'decision-wheel',
    label: 'Decision Wheel',
    icon: '🎡',
    category: 'lifestyle',
    description: 'Spin a canvas wheel to pick randomly from your custom options.',
  },
  {
    id: 'seo-meta-generator',
    label: 'SEO Meta Tags',
    icon: '🔍',
    category: 'web',
    description: 'Preview Google snippets and copy ready-to-paste meta tags.',
  },
  {
    id: 'recipe-scaler',
    label: 'Recipe Scaler',
    icon: '🍳',
    category: 'lifestyle',
    description: 'Scale ingredient lists up or down with a serving-size slider.',
  },
  {
    id: 'baby-name-generator',
    label: 'Baby Name Generator',
    icon: '👶',
    category: 'lifestyle',
    description: 'Browse and shortlist Indian and international baby names offline.',
  },
  {
    id: 'pet-care-scheduler',
    label: 'Pet Care Scheduler',
    icon: '🐾',
    category: 'lifestyle',
    description: 'Track daily and weekly feeding, walks, and grooming tasks.',
  },
  {
    id: 'garden-planting-planner',
    label: 'Garden Planner',
    icon: '🌱',
    category: 'lifestyle',
    description: 'Log sow dates, watering schedules, and planting notes.',
  },
  {
    id: 'construction-estimator',
    label: 'Construction Estimator',
    icon: '🧱',
    category: 'home-diy',
    description: 'Estimate cement, bricks, labor, and material costs with charts.',
  },
  {
    id: 'renovation-budgeter',
    label: 'Renovation Budget',
    icon: '🏠',
    category: 'home-diy',
    description: 'Plan room-by-room renovation line items and expense breakdowns.',
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
    design: [],
    web: [],
    lifestyle: [],
    'home-diy': [],
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
