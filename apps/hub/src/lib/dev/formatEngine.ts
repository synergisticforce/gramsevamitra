export type FormatKind = 'json' | 'csv' | 'xml';

export interface FormatError {
  message: string;
  line?: number;
  column?: number;
}

export interface ConvertResult {
  output: string;
  error: FormatError | null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.match(/("([^"]|"")*"|[^,]*)/g) ?? line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      let v = (values[i] ?? '').trim();
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/""/g, '"');
      row[h] = v;
    });
    return row;
  });
}

function toCSV(data: unknown): string {
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects for CSV conversion.');
  if (data.length === 0) return '';
  const headers = Object.keys(data[0] as object);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = data.map((row) => headers.map((h) => escape((row as Record<string, unknown>)[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

function jsonToXml(obj: unknown, root = 'root', indent = 0): string {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return `${pad}<${root}/>`;
  if (typeof obj !== 'object') {
    const esc = String(obj).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `${pad}<${root}>${esc}</${root}>`;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => jsonToXml(item, `${root.replace(/s$/, '') || 'item'}${i}`, indent)).join('\n');
  }
  const inner = Object.entries(obj as Record<string, unknown>)
    .map(([k, v]) => jsonToXml(v, k.replace(/[^a-zA-Z0-9_-]/g, '_'), indent + 1))
    .join('\n');
  return `${pad}<${root}>\n${inner}\n${pad}</${root}>`;
}

function xmlToJson(xml: string): unknown {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(err.textContent?.trim() || 'Invalid XML syntax.');
  function nodeToObj(node: Element): unknown {
    const children = Array.from(node.children);
    if (children.length === 0) return node.textContent?.trim() ?? '';
    const obj: Record<string, unknown> = {};
    children.forEach((child) => {
      const key = child.tagName;
      const val = nodeToObj(child);
      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        (obj[key] as unknown[]).push(val);
      } else {
        obj[key] = val;
      }
    });
    return obj;
  }
  return nodeToObj(doc.documentElement);
}

function parseJsonError(text: string): FormatError {
  try {
    JSON.parse(text);
    return { message: 'Invalid JSON.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON.';
    const posMatch = msg.match(/position (\d+)/i);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      const before = text.slice(0, pos);
      const line = before.split('\n').length;
      const column = before.length - before.lastIndexOf('\n');
      return { message: msg, line, column };
    }
    return { message: msg };
  }
}

export function validateFormat(kind: FormatKind, text: string): FormatError | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    if (kind === 'json') {
      JSON.parse(trimmed);
    } else if (kind === 'csv') {
      parseCSV(trimmed);
    } else {
      xmlToJson(trimmed);
    }
    return null;
  } catch (e) {
    if (kind === 'json') return parseJsonError(trimmed);
    return { message: e instanceof Error ? e.message : 'Validation failed.' };
  }
}

export function beautify(kind: FormatKind, text: string, pretty: boolean): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (kind === 'json') {
    return JSON.stringify(JSON.parse(trimmed), null, pretty ? 2 : 0);
  }
  if (kind === 'xml' && pretty) {
    const obj = xmlToJson(trimmed);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + jsonToXml(obj, 'root');
  }
  if (kind === 'xml' && !pretty) {
    return trimmed.replace(/>\s+</g, '><').replace(/\n\s*/g, '');
  }
  return trimmed;
}

export function convertFormat(
  from: FormatKind,
  to: FormatKind,
  text: string,
  pretty = true,
): ConvertResult {
  const trimmed = text.trim();
  if (!trimmed) return { output: '', error: null };

  try {
    let result = '';
    if (from === 'csv' && to === 'json') {
      result = JSON.stringify(parseCSV(trimmed), null, pretty ? 2 : 0);
    } else if (from === 'json' && to === 'csv') {
      result = toCSV(JSON.parse(trimmed));
    } else if (from === 'json' && to === 'xml') {
      const parsed = JSON.parse(trimmed);
      const body = jsonToXml(parsed, 'root');
      result = pretty
        ? `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
        : `<?xml version="1.0" encoding="UTF-8"?>${body.replace(/\n\s*/g, '')}`;
    } else if (from === 'xml' && to === 'json') {
      result = JSON.stringify(xmlToJson(trimmed), null, pretty ? 2 : 0);
    } else if (from === 'csv' && to === 'xml') {
      const json = parseCSV(trimmed);
      const body = jsonToXml(json, 'rows');
      result = pretty
        ? `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
        : `<?xml version="1.0" encoding="UTF-8"?>${body.replace(/\n\s*/g, '')}`;
    } else if (from === 'xml' && to === 'csv') {
      result = toCSV(xmlToJson(trimmed) as unknown[]);
    } else if (from === to) {
      result = beautify(from, trimmed, pretty);
    } else {
      throw new Error('Unsupported conversion route.');
    }
    return { output: result, error: null };
  } catch (e) {
    return {
      output: '',
      error: { message: e instanceof Error ? e.message : 'Conversion failed.' },
    };
  }
}

export const CONVERSION_ROUTES: { from: FormatKind; to: FormatKind; label: string }[] = [
  { from: 'csv', to: 'json', label: 'CSV → JSON' },
  { from: 'json', to: 'csv', label: 'JSON → CSV' },
  { from: 'json', to: 'xml', label: 'JSON → XML' },
  { from: 'xml', to: 'json', label: 'XML → JSON' },
  { from: 'csv', to: 'xml', label: 'CSV → XML' },
  { from: 'xml', to: 'csv', label: 'XML → CSV' },
];
