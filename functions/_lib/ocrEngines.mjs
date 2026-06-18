/**
 * Tier 2 / Tier 3 OCR engine adapters (serverless GPU + Google Cloud Vision).
 * Production deployments swap these mocks for real Paddle / GLM / Vision endpoints.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 4000, maxMs = 9000) {
  const span = Math.max(0, maxMs - minMs);
  return sleep(minMs + Math.floor(Math.random() * (span + 1)));
}

function elapsed(start) {
  return Date.now() - start;
}

function wordConfidencePercent(forceLow) {
  if (forceLow) return 62 + Math.random() * 8;
  return 82 + Math.random() * 14;
}

/**
 * @param {{ fileName?: string; pageCount?: number; forceLowConfidence?: boolean; documentType?: string }} opts
 */
export async function callPaddleOcr(opts = {}) {
  const started = Date.now();
  await randomDelay();
  const forceLow = Boolean(opts.forceLowConfidence);
  const avg = wordConfidencePercent(forceLow);
  const documentType = opts.documentType ?? 'general';
  const isInvoice = documentType === 'invoice' || /invoice/i.test(opts.fileName ?? '');
  const isStatement = documentType === 'bank_statement';

  const blocks = [
    {
      id: 'b1',
      type: 'header',
      text: isInvoice ? 'TAX INVOICE' : isStatement ? 'ACCOUNT STATEMENT' : 'DOCUMENT HEADER',
      bbox: [42, 38, 420, 72],
      words: [{ text: 'INVOICE', confidence: avg }],
    },
    {
      id: 'b2',
      type: 'table',
      rows: isInvoice ? 6 : isStatement ? 12 : 3,
      bbox: [40, 180, 560, 420],
      words: [
        { text: 'Item', confidence: avg - 2 },
        { text: 'Qty', confidence: avg - 1 },
        { text: 'Amount', confidence: avg },
      ],
    },
    {
      id: 'b3',
      type: 'key_value',
      pairs: [
        { key: 'GSTIN', value: '29ABCDE1234F1Z5' },
        { key: 'Date', value: '2026-04-01' },
      ],
      bbox: [40, 90, 360, 160],
      words: [{ text: 'GSTIN', confidence: avg }],
    },
  ];

  if (!isInvoice && !isStatement) {
    blocks.pop();
  }

  const layoutFlags = {
    hasTable: blocks.some((b) => b.type === 'table'),
    hasKeyValue: blocks.some((b) => b.type === 'key_value'),
    hasMultiColumn: isStatement,
    hasInvoiceLineItems: isInvoice,
    hasComplexForm: isInvoice || isStatement,
  };

  const flatText = blocks
    .map((b) => b.text || b.words?.map((w) => w.text).join(' ') || '')
    .filter(Boolean)
    .join('\n');

  return {
    engine: 'paddleocr',
    averageWordConfidence: Number(avg.toFixed(2)),
    processingMs: elapsed(started),
    wasColdStart: elapsed(started) < 2500,
    blocks,
    layoutFlags,
    flatText,
    meta: { fileName: opts.fileName ?? 'document.pdf', pages: opts.pageCount ?? 1 },
  };
}

/**
 * @param {{
 *   mode?: 'layout' | 'extract';
 *   blocks?: unknown[];
 *   documentType?: string;
 *   outputFormat?: string;
 *   forceSlowInference?: boolean;
 *   forceBrokenSchema?: boolean;
 * }} opts
 */
export async function callGlmOcr(opts = {}) {
  const started = Date.now();
  const delay = opts.forceSlowInference ? 34_000 : undefined;
  await randomDelay(delay ? 34_000 : 5000, delay ? 36_000 : 10_000);

  const documentType = opts.documentType ?? 'invoice';
  const schemaValid = !opts.forceBrokenSchema;

  const structured =
    documentType === 'bank_statement'
      ? {
          accountHolder: 'Demo User',
          accountNumber: '****4821',
          period: '2026-01-01 — 2026-03-31',
          transactions: [
            { date: '2026-01-05', description: 'UPI/Amazon Pay', debit: 1299.0, credit: 0 },
            { date: '2026-01-12', description: 'NEFT Salary Credit', debit: 0, credit: 85000.0 },
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

  const hierarchy = {
    title: documentType === 'bank_statement' ? 'Statement — ****4821' : 'Invoice #INV-2026-0412',
    sections: [
      { role: 'header', lines: ['Acme Supplies Pvt Ltd', 'GSTIN: 29ABCDE1234F1Z5'] },
      { role: 'table', columns: ['Item', 'Qty', 'Rate', 'Amount'], rows: 6 },
      { role: 'summary', lines: ['Subtotal', 'CGST', 'SGST', 'Total'] },
    ],
    markdown:
      '# Invoice\n\n| Item | Qty | Amount |\n| --- | ---: | ---: |\n| Stationery | 2 | 900 |\n',
  };

  return {
    engine: 'glm-ocr',
    mode: opts.mode ?? 'extract',
    schemaValid,
    processingMs: elapsed(started),
    wasColdStart: elapsed(started) < 3000,
    structured: schemaValid ? structured : { broken: true },
    hierarchy,
    confidence: schemaValid ? 0.91 : 0.2,
  };
}

/**
 * @param {{ reason?: string; simulateUnreadable?: boolean }} opts
 */
export async function callGoogleCloudVision(opts = {}) {
  const started = Date.now();
  await randomDelay(2500, 6000);

  if (opts.simulateUnreadable) {
    return {
      engine: 'google-cloud-vision',
      processingMs: elapsed(started),
      confidence: 0,
      unreadable: true,
      text: '',
      reason: opts.reason ?? 'no_text_detected',
    };
  }

  return {
    engine: 'google-cloud-vision',
    processingMs: elapsed(started),
    confidence: 0.97,
    unreadable: false,
    text: 'Premium vision fallback recovered text from a severely degraded capture.',
    reason: opts.reason ?? 'glm_timeout_or_schema_failure',
    structured: {
      vendor: 'Recovered Vendor Pvt Ltd',
      invoiceNumber: 'INV-VISION-001',
      total: 4838,
    },
  };
}

export function structuredDataToCsv(data) {
  if (data?.transactions) {
    const header = 'date,description,debit,credit';
    const rows = data.transactions.map(
      (t) => `${t.date},"${String(t.description).replace(/"/g, '""')}",${t.debit},${t.credit}`,
    );
    return [header, ...rows].join('\n');
  }

  if (data?.lineItems) {
    const header = 'description,qty,rate,amount';
    const rows = data.lineItems.map(
      (item) =>
        `"${String(item.description).replace(/"/g, '""')}",${item.qty},${item.rate},${item.amount}`,
    );
    const footer = `,,subtotal,${data.subtotal}\n,,tax,${data.tax}\n,,total,${data.total}`;
    return [header, ...rows, footer].join('\n');
  }

  return 'field,value\nresult,extracted';
}
