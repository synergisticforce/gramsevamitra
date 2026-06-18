/** Health & Lifestyle workspace tool registry (Phase 4). */

export type LifestyleToolCategory = 'body' | 'nutrition' | 'dates' | 'wellness';

export type LifestyleToolId =
  | 'bmi-calculator'
  | 'body-fat-calculator'
  | 'macro-calorie-calculator'
  | 'age-date-calculator'
  | 'exam-age-calculator'
  | 'menstrual-calculator'
  | 'mood-daily-log';

export interface LifestyleCanvasTool {
  id: LifestyleToolId;
  label: string;
  icon: string;
  category: LifestyleToolCategory;
  description: string;
}

export const LIFESTYLE_CATEGORY_META: Record<
  LifestyleToolCategory,
  { label: string; description: string }
> = {
  body: {
    label: 'Body composition',
    description: 'BMI and US Navy body-fat estimates from simple measurements.',
  },
  nutrition: {
    label: 'Nutrition & fitness',
    description: 'TDEE and macro targets for independent training goals.',
  },
  dates: {
    label: 'Dates & eligibility',
    description: 'Exact age math and government exam age-window checks.',
  },
  wellness: {
    label: 'Wellness tracking',
    description: 'Cycle predictions and private mood journaling — stored on-device only.',
  },
};

export const LIFESTYLE_CANVAS_TOOLS: LifestyleCanvasTool[] = [
  {
    id: 'bmi-calculator',
    label: 'BMI Calculator',
    icon: '⚖️',
    category: 'body',
    description: 'Metric or imperial height/weight with WHO health-range indicators.',
  },
  {
    id: 'body-fat-calculator',
    label: 'Body Fat Calculator',
    icon: '📏',
    category: 'body',
    description: 'US Navy tape-measure formula using neck, waist, hip, and height.',
  },
  {
    id: 'macro-calorie-calculator',
    label: 'Macro & Calorie Calculator',
    icon: '🥗',
    category: 'nutrition',
    description: 'TDEE from activity level with cut, maintain, or bulk macro splits.',
  },
  {
    id: 'age-date-calculator',
    label: 'Age & Date Calculator',
    icon: '📅',
    category: 'dates',
    description: 'Exact age in years, months, and days — or duration between two dates.',
  },
  {
    id: 'exam-age-calculator',
    label: 'Exam Age Eligibility',
    icon: '🎓',
    category: 'dates',
    description: 'Check DOB against strict min/max age windows for government exams.',
  },
  {
    id: 'menstrual-calculator',
    label: 'Menstrual & Ovulation',
    icon: '🌸',
    category: 'wellness',
    description: 'Predict next period, ovulation day, and fertile window.',
  },
  {
    id: 'mood-daily-log',
    label: 'Mood & Daily Log',
    icon: '📝',
    category: 'wellness',
    description: 'Private emoji + text journal saved in your browser localStorage.',
  },
];

export function getLifestyleTool(id: LifestyleToolId): LifestyleCanvasTool | undefined {
  return LIFESTYLE_CANVAS_TOOLS.find((tool) => tool.id === id);
}

export function lifestyleToolsByCategory(): Record<LifestyleToolCategory, LifestyleCanvasTool[]> {
  const grouped: Record<LifestyleToolCategory, LifestyleCanvasTool[]> = {
    body: [],
    nutrition: [],
    dates: [],
    wellness: [],
  };
  for (const tool of LIFESTYLE_CANVAS_TOOLS) {
    grouped[tool.category].push(tool);
  }
  return grouped;
}

export const LIFESTYLE_TOOL_IDS: LifestyleToolId[] = LIFESTYLE_CANVAS_TOOLS.map((t) => t.id);

export function isLifestyleToolId(value: string): value is LifestyleToolId {
  return LIFESTYLE_TOOL_IDS.includes(value as LifestyleToolId);
}
