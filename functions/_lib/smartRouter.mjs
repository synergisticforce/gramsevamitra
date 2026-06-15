/**
 * Mock serverless GPU / CPU engines for Phase 4 Part 2 (Smart Router).
 * Each call simulates realistic 5–10 s latency before returning stub payloads.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 5000, maxMs = 10000) {
  const span = Math.max(0, maxMs - minMs);
  return sleep(minMs + Math.floor(Math.random() * (span + 1)));
}

function elapsed(start) {
  return Date.now() - start;
}

/**
 * @param {{ fileName?: string; pageCount?: number; forceLowConfidence?: boolean }} opts
 */
export async function callPaddleOCR(opts = {}) {
  const started = Date.now();
  await randomDelay();
  const confidence = opts.forceLowConfidence ? 0.41 : 0.89 + Math.random() * 0.08;

  return {
    engine: 'paddleocr',
    confidence: Number(confidence.toFixed(3)),
    processingMs: elapsed(started),
    blocks: [
      { id: 'b1', type: 'header', text: 'TAX INVOICE', bbox: [42, 38, 420, 72] },
      { id: 'b2', type: 'table', rows: 6, bbox: [40, 180, 560, 420] },
      { id: 'b3', type: 'footer', text: 'Thank you for your business', bbox: [40, 760, 300, 790] },
    ],
    meta: { fileName: opts.fileName ?? 'document.pdf', pages: opts.pageCount ?? 1 },
  };
}

/**
 * @param {{ mode?: 'extract' | 'layout'; blocks?: unknown[]; documentType?: string; forceLowConfidence?: boolean }} opts
 */
export async function callGLM4V(opts = {}) {
  const started = Date.now();
  await randomDelay();
  const confidence = opts.forceLowConfidence ? 0.37 : 0.9 + Math.random() * 0.07;

  if (opts.mode === 'layout') {
    return {
      engine: 'glm-4v',
      mode: 'layout',
      confidence: Number(confidence.toFixed(3)),
      processingMs: elapsed(started),
      hierarchy: {
        title: 'Invoice #INV-2026-0412',
        sections: [
          { role: 'header', lines: ['Acme Supplies Pvt Ltd', 'GSTIN: 29ABCDE1234F1Z5'] },
          { role: 'table', columns: ['Item', 'Qty', 'Rate', 'Amount'], rows: 6 },
          { role: 'summary', lines: ['Subtotal', 'CGST', 'SGST', 'Total'] },
        ],
      },
    };
  }

  const documentType = opts.documentType ?? 'invoice';
  const structured =
    documentType === 'bank_statement'
      ? {
          accountHolder: 'Demo User',
          accountNumber: '****4821',
          period: '2026-01-01 — 2026-03-31',
          transactions: [
            { date: '2026-01-05', description: 'UPI/Amazon Pay', debit: 1299.0, credit: 0 },
            { date: '2026-01-12', description: 'NEFT Salary Credit', debit: 0, credit: 85000.0 },
            { date: '2026-02-02', description: 'ATM Withdrawal', debit: 5000.0, credit: 0 },
          ],
        }
      : {
          vendor: 'Acme Supplies Pvt Ltd',
          invoiceNumber: 'INV-2026-0412',
          invoiceDate: '2026-04-01',
          lineItems: [
            { description: 'Office stationery bundle', qty: 2, rate: 450, amount: 900 },
            { description: 'Printer toner cartridge', qty: 1, rate: 3200, amount: 3200 },
          ],
          subtotal: 4100,
          tax: 738,
          total: 4838,
        };

  return {
    engine: 'glm-4v',
    mode: 'extract',
    confidence: Number(confidence.toFixed(3)),
    processingMs: elapsed(started),
    structured,
  };
}

/**
 * @param {{ hierarchy?: unknown; fileName?: string }} opts
 */
export async function callLibreOffice(opts = {}) {
  const started = Date.now();
  await randomDelay();

  return {
    engine: 'libreoffice-headless',
    processingMs: elapsed(started),
    output: {
      format: 'docx',
      fileName: (opts.fileName ?? 'extracted-document').replace(/\.pdf$/i, '') + '.docx',
      sizeBytes: 482_112,
      pageCount: 3,
      mockDownloadToken: `mock-docx-${Date.now()}`,
    },
    hierarchyApplied: Boolean(opts.hierarchy),
  };
}

/**
 * @param {{ region?: string; reason?: string }} opts
 */
export async function callGoogleVisionFailsafe(opts = {}) {
  const started = Date.now();
  await randomDelay(3000, 7000);

  return {
    engine: 'google-cloud-vision',
    confidence: 0.97,
    processingMs: elapsed(started),
    reason: opts.reason ?? 'low_confidence_region',
    recoveredText:
      'Failsafe OCR recovered low-confidence blocks with Google Cloud Vision API (mock).',
    region: opts.region ?? 'table-body',
  };
}

/**
 * @param {{ outputFormat: string; documentType: string; fileName?: string; forceFailsafe?: boolean }} input
 */
export async function runSmartRouter(input) {
  const outputFormat = (input.outputFormat ?? 'json').toLowerCase();
  const documentType = input.documentType ?? 'invoice';
  const forceFailsafe = Boolean(input.forceFailsafe);
  const pipeline = [];

  const isStructuredRequest =
    outputFormat === 'json' ||
    outputFormat === 'csv' ||
    documentType === 'invoice' ||
    documentType === 'bank_statement';

  /** Scenario A — structured data → GLM-4V single pass */
  if (isStructuredRequest && outputFormat !== 'docx') {
    const glm = await callGLM4V({
      mode: 'extract',
      documentType,
      forceLowConfidence: forceFailsafe,
    });
    pipeline.push({ step: 'scenario-a-glm4v-extract', result: glm });

    let structured = glm.structured;
    let usedFailsafe = false;

    if (glm.confidence < 0.5 || forceFailsafe) {
      const vision = await callGoogleVisionFailsafe({
        reason: forceFailsafe ? 'forced_test' : 'glm_low_confidence',
      });
      pipeline.push({ step: 'failsafe-google-vision', result: vision });
      usedFailsafe = true;
    }

    return {
      scenario: 'A',
      description: 'Advanced AI document extraction with backup accuracy when needed',
      pipeline,
      usedFailsafe,
      output: {
        format: outputFormat === 'csv' ? 'csv' : 'json',
        data: structured,
        csvPreview:
          outputFormat === 'csv'
            ? 'date,description,debit,credit\n2026-01-05,UPI/Amazon Pay,1299,0'
            : undefined,
      },
      totalProcessingMs: pipeline.reduce((sum, p) => sum + (p.result.processingMs ?? 0), 0),
    };
  }

  /** Scenario B — PaddleOCR → GLM-4V layout → LibreOffice DOCX */
  const ocr = await callPaddleOCR({
    fileName: input.fileName,
    forceLowConfidence: forceFailsafe,
  });
  pipeline.push({ step: 'scenario-b-paddleocr', result: ocr });

  let layout = await callGLM4V({
    mode: 'layout',
    blocks: ocr.blocks,
    forceLowConfidence: false,
  });
  pipeline.push({ step: 'scenario-b-glm4v-layout', result: layout });

  let usedFailsafe = false;
  if (ocr.confidence < 0.5 || layout.confidence < 0.5 || forceFailsafe) {
    const vision = await callGoogleVisionFailsafe({
      reason: forceFailsafe ? 'forced_test' : 'ocr_or_layout_low_confidence',
      region: 'mixed',
    });
    pipeline.push({ step: 'failsafe-google-vision', result: vision });
    layout = {
      ...layout,
      confidence: 0.96,
      usedFailsafe: true,
    };
    usedFailsafe = true;
  }

  const docx = await callLibreOffice({
    hierarchy: layout.hierarchy,
    fileName: input.fileName,
  });
  pipeline.push({ step: 'scenario-b-libreoffice-docx', result: docx });

  return {
    scenario: 'B',
    description: 'High-fidelity document conversion with layout preservation',
    pipeline,
    usedFailsafe,
    output: docx.output,
    totalProcessingMs: pipeline.reduce((sum, p) => sum + (p.result.processingMs ?? 0), 0),
  };
}

export const SCENARIO_A_STAGES = [
  'Starting advanced AI engine…',
  'Running intelligent document analysis…',
  'Refining structured data…',
  'Applying backup accuracy check (if needed)…',
  'Finalizing export…',
];

export const SCENARIO_B_STAGES = [
  'Starting advanced AI engine…',
  'Detecting text and layout regions…',
  'Mapping document structure…',
  'Building high-fidelity document…',
  'Finalizing your file…',
];
