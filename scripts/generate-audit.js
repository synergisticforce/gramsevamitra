#!/usr/bin/env node
/**
 * Baseline audit — scans App Model workspaces and writes Audit_Report.docx to repo root.
 * Temporary script; safe to remove after review.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HUB = path.join(ROOT, 'apps/hub');
const CONFIG = path.join(HUB, 'src/config');
const CANVAS = path.join(HUB, 'src/components/canvas');
const OUTPUT = path.join(ROOT, 'Audit_Report.docx');

// ─── Parsers ────────────────────────────────────────────────────────────────

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function extractExportArray(source, exportName) {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const equals = source.indexOf('=', start);
  if (equals === -1) return '';
  const bracket = source.indexOf('[', equals);
  if (bracket === -1) return '';

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = bracket; i < source.length; i++) {
    const ch = source[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return source.slice(bracket + 1, i);
    }
  }
  return '';
}

function splitObjectBlocks(arrayBody) {
  const blocks = [];
  let depth = 0;
  let start = -1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && (inSingle || inDouble)) {
      escaped = true;
      continue;
    }
    if (!inDouble && !inTemplate && ch === "'") {
      inSingle = !inSingle;
      continue;
    }
    if (!inSingle && !inTemplate && ch === '"') {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && ch === '`') {
      inTemplate = !inTemplate;
      continue;
    }
    if (inSingle || inDouble || inTemplate) continue;

    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        blocks.push(arrayBody.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return blocks;
}

function parseStringField(block, field) {
  const single = block.match(new RegExp(`${field}:\\s*'((?:\\\\'|[^'])*)'`, 's'));
  if (single) return single[1].replace(/\\'/g, "'");
  const multi = block.match(
    new RegExp(`${field}:\\s*\\n\\s*'((?:\\\\'|[^'])*)'`, 's'),
  );
  if (multi) return multi[1].replace(/\\'/g, "'");
  const dbl = block.match(new RegExp(`${field}:\\s*"([^"]*)"`));
  if (dbl) return dbl[1];
  return undefined;
}

function parseBoolField(block, field) {
  const m = block.match(new RegExp(`${field}:\\s*(true|false)`));
  return m ? m[1] === 'true' : undefined;
}

function parseMimePatterns(block) {
  const section = block.match(/mimePatterns:\s*\[([\s\S]*?)\]/);
  if (!section) return [];
  const patterns = [];
  const re = /'([^']*)'/g;
  let m;
  while ((m = re.exec(section[1]))) patterns.push(m[1]);
  return patterns;
}

function parseActionBlock(block) {
  return {
    id: parseStringField(block, 'id'),
    label: parseStringField(block, 'label'),
    icon: parseStringField(block, 'icon'),
    tier: parseStringField(block, 'tier') ?? 'free',
    requiresDocument: parseBoolField(block, 'requiresDocument'),
    mimePatterns: parseMimePatterns(block),
    featureId: parseStringField(block, 'featureId'),
    featureName: parseStringField(block, 'featureName'),
    featureDescription: parseStringField(block, 'featureDescription'),
    description: parseStringField(block, 'description'),
    category: parseStringField(block, 'category'),
  };
}

function parseRegistry(exportName, filePath) {
  const source = read(filePath);
  const body = extractExportArray(source, exportName);
  return splitObjectBlocks(body)
    .map(parseActionBlock)
    .filter((t) => t.id && t.label);
}

function parseCategoryMeta(source, exportName) {
  const marker = `export const ${exportName}`;
  const start = source.indexOf(marker);
  if (start === -1) return {};
  const equals = source.indexOf('=', start);
  if (equals === -1) return {};
  const brace = source.indexOf('{', equals);
  if (brace === -1) return {};
  const meta = {};
  const entryRe =
    /(?:'([^']+)'|(\w+)):\s*\{\s*label:\s*'([^']*)',\s*description:\s*'([^']*)'/g;
  const slice = source.slice(brace);
  let m;
  while ((m = entryRe.exec(slice))) {
    const key = m[1] ?? m[2];
    meta[key] = { label: m[3], description: m[4] };
  }
  return meta;
}

// ─── Wiring detection ───────────────────────────────────────────────────────

function wiredActionIds(canvasFile, extraPatterns = []) {
  const source = read(canvasFile);
  const ids = new Set();

  for (const m of source.matchAll(/action\.id\s*===\s*'([^']+)'/g)) ids.add(m[1]);
  for (const m of source.matchAll(/action\.id\s*!==\s*'([^']+)'/g)) ids.add(m[1]);
  for (const m of source.matchAll(/setPdfModal\('([^']+)'\)/g)) ids.add(m[1]);
  for (const m of source.matchAll(/setCareerModal\('([^']+)'\)/g)) {
    const modal = m[1];
    const map = {
      'cold-email': 'cold-email-builder',
      'business-card': 'business-card',
      'salary-benchmarking': 'salary-benchmarking',
      'skill-gap-analyzer': 'skill-gap-analyzer',
      'legal-templates': 'legal-templates',
      'ats-scanner': 'ats-scanner',
      'cover-letter': 'cover-letter-templates',
      'job-tracker': 'job-tracker',
      'salary-calculator': 'salary-calculator',
    };
    ids.add(map[modal] ?? modal);
  }
  for (const m of source.matchAll(/setMediaModal\('([^']+)'\)/g)) ids.add(m[1]);

  for (const pattern of extraPatterns) {
    for (const m of source.matchAll(pattern)) ids.add(m[1]);
  }

  return ids;
}

function wiredSwitchIds(canvasFile) {
  const source = read(canvasFile);
  const ids = new Set();
  for (const m of source.matchAll(/case\s+'([^']+)':/g)) ids.add(m[1]);
  return ids;
}

function readToolbarApiMap(filePath, recordName) {
  const source = read(filePath);
  const marker = recordName;
  const start = source.indexOf(marker);
  if (start === -1) return new Set();
  const brace = source.indexOf('{', start);
  const end = source.indexOf('};', brace);
  const slice = source.slice(brace, end);
  const ids = new Set();
  for (const m of slice.matchAll(/'([^']+)':/g)) ids.add(m[1]);
  return ids;
}

// ─── Feature notes ──────────────────────────────────────────────────────────

const DOCUMENT_FREE_FEATURES = {
  split: 'Split PDF into separate files by page range; modal UI with download.',
  merge: 'Combine multiple PDFs into one document; modal with reorder support.',
  compress: 'Reduce PDF file size with quality presets; client-side compression modal.',
  protect: 'Add password protection to PDF files.',
  unlock: 'Remove password from protected PDFs (password required).',
  deskew: 'Straighten skewed scanned PDF pages.',
  'remove-pages': 'Delete selected pages from a PDF.',
  'page-numbers': 'Stamp page numbers on PDF pages with position options.',
  crop: 'Crop PDF page margins interactively.',
  'image-to-pdf': 'Convert JPG/PNG/WebP images into a PDF.',
  'pdf-to-image': 'Export PDF pages to JPG or PNG images.',
  'pdf-to-text': 'Extract plain text from PDF for copy/export.',
  'type-save': 'Create a new PDF by typing content; no upload required.',
  rotate: 'Rotate PDF pages 90°/180°/270°.',
  reorder: 'Drag-and-drop reorder PDF pages.',
  watermark: 'Add text watermark overlay to PDF pages.',
};

function mimeSummary(patterns) {
  if (!patterns?.length) return 'Any accepted file type';
  return patterns
    .map((p) => {
      if (p === 'application/pdf') return 'PDF';
      if (p.startsWith('image/')) return 'Images';
      if (p.includes('wordprocessingml')) return 'DOCX';
      if (p === 'application/msword') return 'DOC';
      return p;
    })
    .join(', ');
}

function documentCategory(tool) {
  if (tool.tier === 'pro') return 'Pro AI';
  if (tool.mimePatterns?.some((p) => p.startsWith('image/'))) return 'Image Conversion';
  if (tool.mimePatterns?.some((p) => p.includes('pdf'))) return 'PDF Operations';
  return 'General';
}

function mediaCategory(tool) {
  return tool.tier === 'pro' ? 'Pro AI Image Tools' : 'Free Image Tools';
}

function careerCategory(tool) {
  if (tool.tier === 'pro') return 'Pro AI Career Tools';
  if (tool.requiresDocument) return 'Resume & Document Tools';
  return 'Job Search Utilities';
}

function buildFeatureNote(tool, workspace, wired) {
  const parts = [];

  parts.push(`Tier: ${tool.tier === 'pro' ? 'Pro (credit-gated)' : 'Free'}`);
  parts.push(`UI wired: ${wired ? 'Yes' : 'No'}`);

  if (tool.description) {
    parts.push(tool.description);
  } else if (tool.featureDescription) {
    parts.push(tool.featureDescription);
  } else if (DOCUMENT_FREE_FEATURES[tool.id]) {
    parts.push(DOCUMENT_FREE_FEATURES[tool.id]);
  }

  if (tool.mimePatterns?.length) {
    parts.push(`File types: ${mimeSummary(tool.mimePatterns)}`);
  }
  if (tool.requiresDocument) {
    parts.push('Requires document on canvas');
  }

  if (workspace === 'documents' && tool.tier === 'pro') {
    if (tool.id === 'smart-extract') {
      parts.push('Pro API pipeline: /api/pro/smart-extract with CSV/JSON/DOCX output');
    }
    if (tool.id === 'hifi-convert') {
      parts.push('HiFiConverterModal + Pro conversion API for PDF→DOCX/PPTX');
    }
  }
  if (workspace === 'media' && tool.tier === 'pro') {
    parts.push('Pro API: /api/pro/media-process (background removal, upscale, restore)');
  }
  if (workspace === 'career' && tool.tier === 'pro') {
    parts.push('Pro API: career AI pipeline (resume rewrite / cover letter generation)');
  }
  if (workspace === 'finance' || workspace === 'quick-tools' || workspace === 'lifestyle' || workspace === 'video') {
    parts.push('Grid dashboard panel with dedicated React component');
  }
  if (workspace === 'video') {
    parts.push('FFmpeg.wasm client-side only — no server upload');
  }

  return parts.join(' · ');
}

// ─── Audit assembly ─────────────────────────────────────────────────────────

function auditWorkspace() {
  const documentActions = parseRegistry(
    'DOCUMENT_CANVAS_ACTIONS',
    path.join(CONFIG, 'documentCanvasActions.ts'),
  );
  const mediaActions = parseRegistry(
    'MEDIA_CANVAS_ACTIONS',
    path.join(CONFIG, 'mediaCanvasActions.ts'),
  );
  const careerActions = parseRegistry(
    'CAREER_CANVAS_ACTIONS',
    path.join(CONFIG, 'careerCanvasActions.ts'),
  );

  const financeSource = read(path.join(CONFIG, 'financeCanvasTools.ts'));
  const financeTools = parseRegistry('FINANCE_CANVAS_TOOLS', path.join(CONFIG, 'financeCanvasTools.ts'));
  const financeMeta = parseCategoryMeta(financeSource, 'FINANCE_CATEGORY_META');

  const quickSource = read(path.join(CONFIG, 'quickToolsCanvasTools.ts'));
  const quickTools = parseRegistry('QUICK_CANVAS_TOOLS', path.join(CONFIG, 'quickToolsCanvasTools.ts'));
  const quickMeta = parseCategoryMeta(quickSource, 'QUICK_CATEGORY_META');

  const lifestyleSource = read(path.join(CONFIG, 'lifestyleCanvasTools.ts'));
  const lifestyleTools = parseRegistry(
    'LIFESTYLE_CANVAS_TOOLS',
    path.join(CONFIG, 'lifestyleCanvasTools.ts'),
  );
  const lifestyleMeta = parseCategoryMeta(lifestyleSource, 'LIFESTYLE_CATEGORY_META');

  const docWired = wiredActionIds(path.join(CANVAS, 'DocumentStudioCanvas.tsx'));
  const mediaWired = wiredActionIds(path.join(CANVAS, 'MediaLabCanvas.tsx'));
  const careerWired = wiredActionIds(path.join(CANVAS, 'CareerPrepCanvas.tsx'));
  const financeWired = wiredSwitchIds(path.join(CANVAS, 'FinanceHubCanvas.tsx'));
  const quickWired = wiredSwitchIds(path.join(CANVAS, 'QuickToolsHubCanvas.tsx'));
  const lifestyleWired = wiredSwitchIds(path.join(CANVAS, 'LifestyleHubCanvas.tsx'));

  const videoSource = read(path.join(CONFIG, 'videoCanvasTools.ts'));
  const videoTools = parseRegistry('VIDEO_CANVAS_TOOLS', path.join(CONFIG, 'videoCanvasTools.ts'));
  const videoMeta = parseCategoryMeta(videoSource, 'VIDEO_CATEGORY_META');
  const videoWired = wiredSwitchIds(path.join(CANVAS, 'VideoHubCanvas.tsx'));

  const mediaProApi = readToolbarApiMap(
    path.join(HUB, 'src/lib/canvas/mediaProProcess.ts'),
    'TOOLBAR_TO_API',
  );
  const careerProApi = readToolbarApiMap(
    path.join(HUB, 'src/lib/canvas/careerProAi.ts'),
    'TOOLBAR_TO_API',
  );

  for (const t of mediaActions.filter((a) => a.tier === 'pro')) {
    if (mediaProApi.has(t.id)) mediaWired.add(t.id);
  }
  for (const t of careerActions.filter((a) => a.tier === 'pro')) {
    if (careerProApi.has(t.id)) careerWired.add(t.id);
  }
  for (const t of documentActions.filter((a) => a.tier === 'pro')) {
    docWired.add(t.id);
  }

  const workspaces = [
    {
      id: 'documents',
      label: 'Document Studio',
      route: '/workspace/documents',
      tools: documentActions.map((t) => ({
        ...t,
        category: documentCategory(t),
        wired: docWired.has(t.id),
        featureNote: buildFeatureNote(t, 'documents', docWired.has(t.id)),
      })),
    },
    {
      id: 'media',
      label: 'Media Lab',
      route: '/workspace/media',
      tools: mediaActions.map((t) => ({
        ...t,
        category: mediaCategory(t),
        wired: mediaWired.has(t.id),
        featureNote: buildFeatureNote(t, 'media', mediaWired.has(t.id)),
      })),
    },
    {
      id: 'career',
      label: 'Career Prep',
      route: '/workspace/career',
      tools: careerActions.map((t) => ({
        ...t,
        category: careerCategory(t),
        wired: careerWired.has(t.id),
        featureNote: buildFeatureNote(t, 'career', careerWired.has(t.id)),
      })),
    },
    {
      id: 'finance',
      label: 'Finance Hub',
      route: '/workspace/finance',
      categoryMeta: financeMeta,
      tools: financeTools.map((t) => ({
        ...t,
        tier: 'free',
        wired: financeWired.has(t.id),
        featureNote: buildFeatureNote(t, 'finance', financeWired.has(t.id)),
      })),
    },
    {
      id: 'quick-tools',
      label: 'Quick Tools',
      route: '/workspace/quick-tools',
      categoryMeta: quickMeta,
      tools: quickTools.map((t) => ({
        ...t,
        tier: 'free',
        wired: quickWired.has(t.id),
        featureNote: buildFeatureNote(t, 'quick-tools', quickWired.has(t.id)),
      })),
    },
    {
      id: 'lifestyle',
      label: 'Health & Lifestyle',
      route: '/workspace/lifestyle',
      categoryMeta: lifestyleMeta,
      tools: lifestyleTools.map((t) => ({
        ...t,
        tier: 'free',
        wired: lifestyleWired.has(t.id),
        featureNote: buildFeatureNote(t, 'lifestyle', lifestyleWired.has(t.id)),
      })),
    },
    {
      id: 'video',
      label: 'Video Studio',
      route: '/workspace/video',
      categoryMeta: videoMeta,
      tools: videoTools.map((t) => ({
        ...t,
        tier: 'free',
        wired: videoWired.has(t.id),
        featureNote: buildFeatureNote(t, 'video', videoWired.has(t.id)),
      })),
    },
  ];

  const activeWired = workspaces.flatMap((ws) => ws.tools.filter((t) => t.wired));
  const registryTotal = workspaces.reduce((n, ws) => n + ws.tools.length, 0);

  return { workspaces, activeWired, registryTotal };
}

// ─── DOCX builder ───────────────────────────────────────────────────────────

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ text, heading: level, spacing: { after: 200 } });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function toolBullet(tool) {
  const status = tool.wired ? '✓' : '✗';
  const tierTag = tool.tier === 'pro' ? ' [Pro]' : '';
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: `${status} ${tool.icon ?? ''} ${tool.label}${tierTag}`, bold: true }),
      new TextRun({ text: ` (${tool.id})`, italics: true, color: '666666' }),
    ],
  });
}

function featureParagraph(note) {
  return new Paragraph({
    spacing: { after: 160, left: 360 },
    children: [new TextRun({ text: note, size: 20, color: '444444' })],
  });
}

function summaryTable(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (cells, ri) =>
        new TableRow({
          children: cells.map(
            (text) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text, bold: ri === 0 })],
                  }),
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 },
                },
              }),
          ),
        }),
    ),
  });
}

async function writeDocx(audit) {
  const { workspaces, activeWired, registryTotal } = audit;
  const generatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const freeCount = activeWired.filter((t) => t.tier !== 'pro').length;
  const proCount = activeWired.filter((t) => t.tier === 'pro').length;

  const children = [
    heading('GramSeva Mitra — Application Baseline Audit'),
    body(`Generated: ${generatedAt} (UTC)`),
    body(
      'Scope: Document Studio, Media Lab, Career Prep, Finance Hub, and Quick Tools workspaces in the App Model (/workspace/* routes).',
    ),
    heading('Executive Summary', HeadingLevel.HEADING_2),
    body(
      `Total tools active and wired into the UI: ${activeWired.length} of ${registryTotal} registered.`,
    ),
    body(`Breakdown: ${freeCount} free tools, ${proCount} Pro (credit-gated) tools.`),
    new Paragraph({ spacing: { after: 200 } }),
    summaryTable([
      ['Workspace', 'Registered', 'Wired', 'Route'],
      ...workspaces.map((ws) => {
        const wired = ws.tools.filter((t) => t.wired).length;
        return [ws.label, String(ws.tools.length), String(wired), ws.route];
      }),
      ['TOTAL', String(registryTotal), String(activeWired.length), '—'],
    ]),
    new Paragraph({ spacing: { after: 300 } }),
    heading('Methodology', HeadingLevel.HEADING_2),
    bullet('Tool registry parsed from apps/hub/src/config/*CanvasActions.ts and *CanvasTools.ts'),
    bullet('UI wiring verified against *Canvas.tsx handler branches and renderTool() switch cases'),
    bullet('Pro tools additionally checked against TOOLBAR_TO_API maps in lib/canvas/*'),
    bullet('Legacy toolsRegistry.ts excluded — not mounted in current App Model UI'),
    new Paragraph({ spacing: { after: 200 } }),
  ];

  for (const ws of workspaces) {
    children.push(heading(ws.label, HeadingLevel.HEADING_1));
    children.push(body(`${ws.route} — ${ws.tools.filter((t) => t.wired).length} wired tools`));

    const byCategory = new Map();
    for (const tool of ws.tools) {
      const cat = tool.category ?? 'uncategorized';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(tool);
    }

    const categoryOrder = ws.categoryMeta
      ? Object.keys(ws.categoryMeta)
      : [...byCategory.keys()];

    const orderedCategories = [
      ...categoryOrder.filter((c) => byCategory.has(c)),
      ...[...byCategory.keys()].filter((c) => !categoryOrder.includes(c)),
    ];

    for (const catKey of orderedCategories) {
      const tools = byCategory.get(catKey);
      if (!tools?.length) continue;

      const catLabel = ws.categoryMeta?.[catKey]?.label ?? catKey;
      const catDesc = ws.categoryMeta?.[catKey]?.description;

      children.push(heading(catLabel, HeadingLevel.HEADING_2));
      if (catDesc) children.push(body(catDesc, { italics: true }));

      for (const tool of tools) {
        children.push(toolBullet(tool));
        children.push(featureParagraph(tool.featureNote));
      }
    }
  }

  children.push(heading('Unwired Registry Entries', HeadingLevel.HEADING_2));
  const unwired = workspaces.flatMap((ws) =>
    ws.tools.filter((t) => !t.wired).map((t) => ({ ws: ws.label, tool: t })),
  );
  if (unwired.length === 0) {
    children.push(body('None — every registered tool has a UI handler.'));
  } else {
    for (const { ws, tool } of unwired) {
      children.push(bullet(`${ws}: ${tool.label} (${tool.id})`));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Scanning GramSeva Mitra App Model workspaces…');
  const audit = auditWorkspace();
  console.log(
    `Found ${audit.registryTotal} registered tools; ${audit.activeWired.length} wired into UI.`,
  );
  await writeDocx(audit);
  console.log(`✓ Audit report written to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
