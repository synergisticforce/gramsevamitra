export type DataFormat = 'json' | 'csv' | 'xml';

export interface ConvertResult {
  ok: boolean;
  output?: string;
  error?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i += 1;
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

function csvToJson(text: string): unknown {
  const rows = parseCsvRows(text.trim());
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((cells) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key.trim() || `col${idx + 1}`] = cells[idx] ?? '';
    });
    return obj;
  });
}

function jsonToCsv(data: unknown): string {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return '';

  const headers = Array.from(
    rows.reduce((set, row) => {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        Object.keys(row as object).forEach((k) => set.add(k));
      }
      return set;
    }, new Set<string>()),
  );

  if (headers.length === 0) {
    throw new Error('JSON must be an object or array of objects for CSV export.');
  }

  const escapeCell = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    const obj = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
    lines.push(headers.map((h) => escapeCell(obj[String(h)])).join(','));
  }
  return lines.join('\n');
}

function jsonToXml(data: unknown, rootName = 'root'): string {
  const toXml = (value: unknown, tag: string): string => {
    if (value === null || value === undefined) {
      return `<${tag}/>`;
    }
    if (Array.isArray(value)) {
      return value.map((item, i) => toXml(item, `${tag}_item${i + 1}`)).join('');
    }
    if (typeof value === 'object') {
      const inner = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => toXml(v, k.replace(/[^a-zA-Z0-9_-]/g, '_')))
        .join('');
      return `<${tag}>${inner}</${tag}>`;
    }
    return `<${tag}>${escapeXml(String(value))}</${tag}>`;
  };

  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(data, rootName)}`;
}

function xmlNodeToJson(node: Node): unknown {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? '';
    return text || undefined;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const children = Array.from(el.childNodes).filter(
    (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()),
  );

  if (children.length === 0) return '';

  const textOnly = children.every((n) => n.nodeType === Node.TEXT_NODE);
  if (textOnly) return el.textContent?.trim() ?? '';

  const obj: Record<string, unknown> = {};
  for (const child of children) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const key = child.nodeName;
    const value = xmlNodeToJson(child);
    if (obj[key] === undefined) {
      obj[key] = value;
    } else if (Array.isArray(obj[key])) {
      (obj[key] as unknown[]).push(value);
    } else {
      obj[key] = [obj[key], value];
    }
  }
  return obj;
}

function xmlToJson(text: string): unknown {
  const doc = new DOMParser().parseFromString(text.trim(), 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Invalid XML syntax.');
  const root = doc.documentElement;
  if (!root) throw new Error('XML has no root element.');
  return { [root.nodeName]: xmlNodeToJson(root) };
}

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

export function convertDataFormat(
  input: string,
  from: DataFormat,
  to: DataFormat,
): ConvertResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Paste input data first.' };
  if (from === to) return { ok: true, output: input };

  try {
    let data: unknown;

    if (from === 'json') data = parseJson(trimmed);
    else if (from === 'csv') data = csvToJson(trimmed);
    else data = xmlToJson(trimmed);

    if (to === 'json') {
      return { ok: true, output: JSON.stringify(data, null, 2) };
    }
    if (to === 'csv') {
      return { ok: true, output: jsonToCsv(data) };
    }
    return { ok: true, output: jsonToXml(data) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Conversion failed.',
    };
  }
}

export function validateFormat(text: string, format: DataFormat): ConvertResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Nothing to validate.' };
  try {
    if (format === 'json') {
      parseJson(trimmed);
      return { ok: true, output: 'Valid JSON.' };
    }
    if (format === 'csv') {
      const rows = parseCsvRows(trimmed);
      if (rows.length === 0) throw new Error('CSV is empty.');
      return { ok: true, output: `Valid CSV — ${rows.length} row(s), ${rows[0].length} column(s).` };
    }
    xmlToJson(trimmed);
    return { ok: true, output: 'Valid XML.' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Validation failed.' };
  }
}
