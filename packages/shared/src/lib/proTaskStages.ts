/** Multi-stage Pro task loader copy — shared between API docs and UI. */

export const PRO_TASK_STAGES_DEFAULT = [
  'Starting advanced AI engine…',
  'Analyzing document layout…',
  'Refining extracted data…',
  'Finalizing your file…',
];

export const PRO_TASK_STAGES_SCENARIO_A = [
  'Starting advanced AI engine…',
  'Running intelligent document analysis…',
  'Refining structured data…',
  'Applying backup accuracy check (if needed)…',
  'Finalizing export…',
];

export const PRO_TASK_STAGES_OCR_WATERFALL = [
  'Enhancing text clarity…',
  'Parsing layout matrix…',
  'Applying deep AI reconstruction…',
  'Applying premium vision fallback…',
  'Finalizing extraction…',
];

export const PRO_TASK_STAGES_SCENARIO_B = [
  'Starting advanced AI engine…',
  'Detecting text and layout regions…',
  'Mapping document structure…',
  'Building high-fidelity document…',
  'Finalizing your file…',
];

export function stagesForOutputFormat(outputFormat: 'json' | 'csv' | 'docx'): string[] {
  return outputFormat === 'docx' ? PRO_TASK_STAGES_SCENARIO_B : PRO_TASK_STAGES_SCENARIO_A;
}

export function stagesForOcrOrchestrator(): string[] {
  return PRO_TASK_STAGES_OCR_WATERFALL;
}

export interface OcrOrchestratorResponse {
  success: boolean;
  pipeline?: Array<{ tier: string; step: string; result: unknown }>;
  stages?: string[];
  usedVision?: boolean;
  processingMs?: number;
  remainingCredits?: number;
  creditsUsed?: number;
  tier1Bypassed?: boolean;
  sourceFile?: string;
  output?: {
    format?: string;
    data?: unknown;
    csv?: string;
    text?: string;
    fileName?: string;
    mockDownloadToken?: string;
    hierarchy?: unknown;
  };
  unreadable?: boolean;
  message?: string;
  error?: string;
}

export interface SmartRouterResponse {
  success: boolean;
  scenario?: 'A' | 'B';
  description?: string;
  usedFailsafe?: boolean;
  totalProcessingMs?: number;
  output?: unknown;
  pipeline?: Array<{ step: string; result: unknown }>;
  error?: string;
  message?: string;
}
