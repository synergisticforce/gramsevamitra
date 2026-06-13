/** Multi-stage Pro task loader copy — shared between API docs and UI. */

export const PRO_TASK_STAGES_DEFAULT = [
  'Waking up AI engine…',
  'Analyzing document layout…',
  'Refining extracted data…',
  'Finalizing file…',
];

export const PRO_TASK_STAGES_SCENARIO_A = [
  'Waking up AI engine…',
  'Running GLM-4V vision extraction…',
  'Refining structured data…',
  'Applying Vision API failsafe (if needed)…',
  'Finalizing export…',
];

export const PRO_TASK_STAGES_SCENARIO_B = [
  'Waking up AI engine…',
  'PaddleOCR bounding-box detection…',
  'GLM-4V layout hierarchy mapping…',
  'LibreOffice Headless DOCX render…',
  'Finalizing file…',
];

export function stagesForOutputFormat(outputFormat: 'json' | 'csv' | 'docx'): string[] {
  return outputFormat === 'docx' ? PRO_TASK_STAGES_SCENARIO_B : PRO_TASK_STAGES_SCENARIO_A;
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
