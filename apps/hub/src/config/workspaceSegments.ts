import {
  TOOLS_REGISTRY,
  type ToolEntry,
  type ToolWorkspace,
} from './toolsRegistry';

export interface SegmentItem {
  id: string;
  label: string;
  href: string;
}

export type WorkspaceSegmentId = string;

export interface WorkspaceSegmentDef extends SegmentItem {
  /** Registry tool ids in this segment (excludes workspace dashboard routes). */
  toolIds: string[];
}

const MONEY_SEGMENTS: WorkspaceSegmentDef[] = [
  {
    id: 'all',
    label: 'All',
    href: '/tools/money',
    toolIds: [],
  },
  {
    id: 'calculators',
    label: 'Calculators',
    href: '/tools/money#calculators',
    toolIds: [
      'emi-calculator',
      'sip-calculator',
      'gst-calculator',
      'discount-calculator',
      'loan-repayment',
      'tip-calculator',
      'multi-currency',
    ],
  },
  {
    id: 'business',
    label: 'Invoicing',
    href: '/tools/money#business',
    toolIds: ['invoice-builder', 'pay-stub-generator', 'meeting-cost'],
  },
  {
    id: 'tax',
    label: 'Tax & Crypto',
    href: '/tools/money#tax',
    toolIds: ['tax-deduction-tracker', 'crypto-tax'],
  },
];

const WRITING_SEGMENTS: WorkspaceSegmentDef[] = [
  { id: 'all', label: 'All', href: '/tools/writing', toolIds: [] },
  {
    id: 'editor',
    label: 'Editor',
    href: '/tools/writing#editor',
    toolIds: ['word-counter', 'case-converter', 'handwriting-converter'],
  },
  {
    id: 'study',
    label: 'Study',
    href: '/tools/writing#study',
    toolIds: [
      'citation-generator',
      'plagiarism-checker',
      'flashcard-maker',
      'flashcard-generator',
      'gpa-calculator',
      'mindmap-builder',
      'phonetic-alphabet',
    ],
  },
  {
    id: 'media',
    label: 'Speech & OCR',
    href: '/tools/writing#media',
    toolIds: ['speech-to-text', 'text-to-speech', 'ocr-extractor'],
  },
];

const CAREER_SEGMENTS: WorkspaceSegmentDef[] = [
  { id: 'all', label: 'All', href: '/tools/career', toolIds: [] },
  {
    id: 'track',
    label: 'Track',
    href: '/tools/career#track',
    toolIds: ['job-tracker', 'salary-calculator', 'salary-benchmarking'],
  },
  {
    id: 'build',
    label: 'Build',
    href: '/tools/career#build',
    toolIds: ['cold-email', 'business-card', 'legal-templates'],
  },
  {
    id: 'skills',
    label: 'Skills',
    href: '/tools/career#skills',
    toolIds: ['skill-gap', 'typing-speed-test', 'ats-keyword-matcher'],
  },
];

const LIFE_SEGMENTS: WorkspaceSegmentDef[] = [
  { id: 'all', label: 'All', href: '/tools/life', toolIds: [] },
  {
    id: 'health',
    label: 'Health',
    href: '/tools/life#health',
    toolIds: ['bmi-calculator', 'body-fat', 'macro-calculator', 'age-calculator', 'exam-age-eligibility'],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    href: '/tools/life#wellness',
    toolIds: ['menstrual-tracker', 'mood-tracker'],
  },
  {
    id: 'focus',
    label: 'Focus',
    href: '/tools/life#focus',
    toolIds: ['event-countdown'],
  },
];

const QUICK_SEGMENTS: WorkspaceSegmentDef[] = [
  { id: 'all', label: 'All', href: '/tools/quick', toolIds: [] },
  {
    id: 'convert',
    label: 'Convert',
    href: '/tools/quick#convert',
    toolIds: [
      'unit-converter',
      'percentage-calculator',
      'scientific-calculator',
      'base64',
      'url-encoder',
      'hash-generator',
      'format-converter',
    ],
  },
  {
    id: 'generate',
    label: 'Generate',
    href: '/tools/quick#generate',
    toolIds: [
      'qr-generator',
      'password-generator',
      'random-number',
      'baby-names',
      'decision-wheel',
      'seo-meta',
      'color-palette',
    ],
  },
  {
    id: 'lifestyle',
    label: 'Life & Docs',
    href: '/tools/quick#lifestyle',
    toolIds: [
      'exam-photo-studio',
      'document-redactor',
      'recipe-scaler',
      'pet-feeding',
      'gardening-planner',
      'construction-materials',
      'home-renovation',
    ],
  },
];

export const WORKSPACE_SEGMENT_DEFS: Record<ToolWorkspace, WorkspaceSegmentDef[]> = {
  money: MONEY_SEGMENTS,
  writing: WRITING_SEGMENTS,
  career: CAREER_SEGMENTS,
  life: LIFE_SEGMENTS,
  quick: QUICK_SEGMENTS,
};

const TOOL_ID_TO_SEGMENT = new Map<string, { workspace: ToolWorkspace; segmentId: string }>();

for (const [workspace, segments] of Object.entries(WORKSPACE_SEGMENT_DEFS) as [
  ToolWorkspace,
  WorkspaceSegmentDef[],
][]) {
  for (const segment of segments) {
    if (segment.id === 'all') continue;
    for (const toolId of segment.toolIds) {
      TOOL_ID_TO_SEGMENT.set(toolId, { workspace, segmentId: segment.id });
    }
  }
}

export function getWorkspaceSegments(workspace: ToolWorkspace): SegmentItem[] {
  return WORKSPACE_SEGMENT_DEFS[workspace].map(({ id, label, href }) => ({ id, label, href }));
}

export function resolveSegmentId(pathname: string, workspace: ToolWorkspace): string {
  const entry = TOOLS_REGISTRY.find((t) => t.path === pathname);
  if (!entry) return 'all';
  const mapped = TOOL_ID_TO_SEGMENT.get(entry.id);
  if (mapped?.workspace === workspace) return mapped.segmentId;
  return 'all';
}

export function getToolsForSegment(workspace: ToolWorkspace, segmentId: string): ToolEntry[] {
  const prefix = `/tools/${workspace}/`;
  const all = TOOLS_REGISTRY.filter(
    (t) => t.workspace === workspace && t.path.startsWith(prefix),
  );

  if (segmentId === 'all') return all;

  const segment = WORKSPACE_SEGMENT_DEFS[workspace].find((s) => s.id === segmentId);
  if (!segment) return all;

  const idSet = new Set(segment.toolIds);
  return all.filter((t) => idSet.has(t.id));
}

export function getSegmentAnchorId(workspace: ToolWorkspace, toolId: string): string | null {
  const mapped = TOOL_ID_TO_SEGMENT.get(toolId);
  if (!mapped || mapped.workspace !== workspace) return null;
  return mapped.segmentId;
}
