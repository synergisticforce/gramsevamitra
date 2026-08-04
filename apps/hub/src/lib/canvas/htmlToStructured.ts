/**
 * Converts the layout HTML returned by Gemini Vision into structured data
 * formats. Runs entirely in the browser, so no extra server round-trip and no
 * additional AI Credits are needed once the HTML has been produced.
 */

function parseFragment(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(`<div id="gsm-root">${html}</div>`, 'text/html');
  return parsed.getElementById('gsm-root') ?? parsed.body;
}

function cellText(cell: Element): string {
  return (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function tableRows(table: HTMLTableElement): string[][] {
  const rows = Array.from(
    table.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr'),
  );
  const source = rows.length > 0 ? rows : Array.from(table.rows);

  return source
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => /^(td|th)$/i.test(cell.tagName))
        .flatMap((cell) => {
          const span = Number(cell.getAttribute('colspan') ?? '1');
          const text = cellText(cell);
          // A merged cell becomes its value plus blanks so columns stay aligned.
          return span > 1 ? [text, ...Array(span - 1).fill('')] : [text];
        }),
    )
    .filter((row) => row.some((value) => value !== ''));
}

/** Every table in the document, in reading order. */
export function extractTables(html: string): string[][][] {
  const root = parseFragment(html);
  return Array.from(root.querySelectorAll('table'))
    .map((table) => tableRows(table as HTMLTableElement))
    .filter((rows) => rows.length > 0);
}

/** Non-table text blocks, used as a fallback when the page has no tables. */
function extractTextRows(html: string): string[][] {
  const root = parseFragment(html);
  root.querySelectorAll('table').forEach((table) => table.remove());

  return Array.from(root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, div'))
    .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0)
    .map((text) => [text]);
}

function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function padRows(rows: string[][]): string[][] {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
}

/**
 * CSV export. Multiple tables are separated by a blank line and a caption row
 * so nothing from the original document is silently dropped.
 */
export function htmlToCsv(html: string): string {
  const tables = extractTables(html);
  const blocks = tables.length > 0 ? tables : [extractTextRows(html)];

  const sections = blocks.map((rows, index) => {
    const body = padRows(rows)
      .map((row) => row.map(escapeCsvCell).join(','))
      .join('\n');
    if (blocks.length === 1) return body;
    return `${escapeCsvCell(`Table ${index + 1}`)}\n${body}`;
  });

  const csv = sections.join('\n\n').trim();
  return csv || 'No tabular data detected';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** XML export with the first row of each table promoted to column names. */
export function htmlToXml(html: string): string {
  const tables = extractTables(html);
  const blocks = tables.length > 0 ? tables : [extractTextRows(html)];

  const body = blocks
    .map((rawRows, tableIndex) => {
      const rows = padRows(rawRows);
      const [header, ...dataRows] = rows;
      const columns = (header ?? []).map((name, index) => {
        const cleaned = (name || `column_${index + 1}`)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
        return cleaned || `column_${index + 1}`;
      });

      const entries = (dataRows.length > 0 ? dataRows : rows).map((row, rowIndex) => {
        const cells = row
          .map(
            (value, index) =>
              `      <${columns[index] ?? `column_${index + 1}`}>${escapeXml(value)}</${
                columns[index] ?? `column_${index + 1}`
              }>`,
          )
          .join('\n');
        return `    <row index="${rowIndex + 1}">\n${cells}\n    </row>`;
      });

      return `  <table index="${tableIndex + 1}">\n${entries.join('\n')}\n  </table>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<document>\n${body}\n</document>\n`;
}
