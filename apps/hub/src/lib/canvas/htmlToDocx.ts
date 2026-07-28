import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
  type IRunOptions,
} from 'docx';

interface ParsedStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  color?: string;
  fontSizeHalfPoints?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  shading?: string;
}

type DocChild = Paragraph | Table;

const TABLE_BORDER: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 8,
  color: '94A3B8',
};

const NO_BORDER: IBorderOptions = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

function normalizeHexColor(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (!value || value === 'transparent' || value === 'inherit' || value === 'initial') {
    return undefined;
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex) {
    const body = hex[1];
    if (body.length === 3) {
      return body
        .split('')
        .map((ch) => `${ch}${ch}`)
        .join('')
        .toUpperCase();
    }
    return body.toUpperCase();
  }

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  const named: Record<string, string> = {
    black: '000000',
    white: 'FFFFFF',
    red: 'DC2626',
    blue: '2563EB',
    green: '059669',
    gray: '64748B',
    grey: '64748B',
    navy: '1E3A8A',
    orange: 'EA580C',
    purple: '7C3AED',
    teal: '0D9488',
  };
  return named[value];
}

function cssSizeToHalfPoints(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  const px = /^([\d.]+)\s*px$/.exec(value);
  if (px) return Math.max(16, Math.round(Number(px[1]) * 1.5));
  const pt = /^([\d.]+)\s*pt$/.exec(value);
  if (pt) return Math.max(16, Math.round(Number(pt[1]) * 2));
  const em = /^([\d.]+)\s*em$/.exec(value);
  if (em) return Math.max(16, Math.round(Number(em[1]) * 22));
  const rem = /^([\d.]+)\s*rem$/.exec(value);
  if (rem) return Math.max(16, Math.round(Number(rem[1]) * 22));
  const percent = /^([\d.]+)\s*%$/.exec(value);
  if (percent) return Math.max(16, Math.round((Number(percent[1]) / 100) * 22));
  return undefined;
}

function parseInlineStyle(styleAttr: string | null): ParsedStyle {
  const style: ParsedStyle = {};
  if (!styleAttr) return style;

  for (const declaration of styleAttr.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon <= 0) continue;
    const prop = declaration.slice(0, colon).trim().toLowerCase();
    const val = declaration.slice(colon + 1).trim();
    if (!val) continue;

    if (prop === 'color') style.color = normalizeHexColor(val);
    else if (prop === 'background' || prop === 'background-color') style.shading = normalizeHexColor(val);
    else if (prop === 'font-weight') {
      const weight = Number(val);
      if (val === 'bold' || val === 'bolder' || (!Number.isNaN(weight) && weight >= 600)) {
        style.bold = true;
      }
    } else if (prop === 'font-style' && (val === 'italic' || val === 'oblique')) {
      style.italics = true;
    } else if (prop === 'text-decoration' && val.includes('underline')) {
      style.underline = true;
    } else if (prop === 'font-size') {
      style.fontSizeHalfPoints = cssSizeToHalfPoints(val);
    } else if (prop === 'text-align') {
      if (val === 'center') style.align = AlignmentType.CENTER;
      else if (val === 'right') style.align = AlignmentType.RIGHT;
      else if (val === 'justify') style.align = AlignmentType.BOTH;
      else if (val === 'left') style.align = AlignmentType.LEFT;
    }
  }

  return style;
}

function mergeStyles(parent: ParsedStyle, child: ParsedStyle): ParsedStyle {
  return {
    bold: child.bold ?? parent.bold,
    italics: child.italics ?? parent.italics,
    underline: child.underline ?? parent.underline,
    color: child.color ?? parent.color,
    fontSizeHalfPoints: child.fontSizeHalfPoints ?? parent.fontSizeHalfPoints,
    align: child.align ?? parent.align,
    shading: child.shading ?? parent.shading,
  };
}

function headingLevelForTag(tag: string): (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined {
  switch (tag) {
    case 'h1':
      return HeadingLevel.HEADING_1;
    case 'h2':
      return HeadingLevel.HEADING_2;
    case 'h3':
      return HeadingLevel.HEADING_3;
    case 'h4':
      return HeadingLevel.HEADING_4;
    case 'h5':
      return HeadingLevel.HEADING_5;
    case 'h6':
      return HeadingLevel.HEADING_6;
    default:
      return undefined;
  }
}

function defaultSizeForTag(tag: string): number | undefined {
  switch (tag) {
    case 'h1':
      return 36;
    case 'h2':
      return 32;
    case 'h3':
      return 28;
    case 'h4':
      return 26;
    case 'h5':
      return 24;
    case 'h6':
      return 22;
    default:
      return undefined;
  }
}

function collectTextRuns(node: Node, inherited: ParsedStyle, out: TextRun[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return;
    if (!text.trim() && !/\u00a0/.test(text)) {
      if (text.includes(' ')) out.push(new TextRun({ text: ' ' }));
      return;
    }

    const options: IRunOptions = {
      text,
      ...(inherited.bold ? { bold: true } : {}),
      ...(inherited.italics ? { italics: true } : {}),
      ...(inherited.underline ? { underline: {} } : {}),
      ...(inherited.color ? { color: inherited.color } : {}),
      ...(inherited.fontSizeHalfPoints ? { size: inherited.fontSizeHalfPoints } : {}),
    };
    out.push(new TextRun(options));
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    out.push(new TextRun({ break: 1 }));
    return;
  }
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return;

  let next = mergeStyles(inherited, parseInlineStyle(el.getAttribute('style')));
  if (tag === 'strong' || tag === 'b') next = { ...next, bold: true };
  if (tag === 'em' || tag === 'i') next = { ...next, italics: true };
  if (tag === 'u') next = { ...next, underline: true };
  if (tag === 'mark') next = { ...next, shading: next.shading ?? 'FEF08A' };

  const colorAttr = normalizeHexColor(el.getAttribute('color'));
  if (colorAttr) next = { ...next, color: colorAttr };

  for (const child of Array.from(el.childNodes)) {
    collectTextRuns(child, next, out);
  }
}

function paragraphFromElement(el: HTMLElement, inherited: ParsedStyle = {}): Paragraph {
  const tag = el.tagName.toLowerCase();
  const style = mergeStyles(inherited, parseInlineStyle(el.getAttribute('style')));
  if (tag.startsWith('h')) {
    style.bold = true;
    style.fontSizeHalfPoints = style.fontSizeHalfPoints ?? defaultSizeForTag(tag);
  }

  const runs: TextRun[] = [];
  for (const child of Array.from(el.childNodes)) {
    collectTextRuns(child, style, runs);
  }
  if (runs.length === 0) runs.push(new TextRun({ text: '' }));

  return new Paragraph({
    children: runs,
    heading: headingLevelForTag(tag),
    alignment: style.align,
    spacing: { after: tag.startsWith('h') ? 200 : 120 },
  });
}

function cellParagraphs(cell: HTMLElement): Paragraph[] {
  const style = parseInlineStyle(cell.getAttribute('style'));
  const blocks = Array.from(cell.children).filter((child) => {
    const tag = child.tagName.toLowerCase();
    return tag === 'p' || tag.startsWith('h') || tag === 'div' || tag === 'li';
  }) as HTMLElement[];

  if (blocks.length > 0) {
    return blocks.map((block) => {
      const paragraph = paragraphFromElement(block, style);
      if (cell.tagName.toLowerCase() !== 'th') return paragraph;
      return paragraph;
    });
  }

  const headerBoost =
    cell.tagName.toLowerCase() === 'th' ? mergeStyles(style, { bold: true }) : style;
  const runs: TextRun[] = [];
  collectTextRuns(cell, headerBoost, runs);
  return [
    new Paragraph({
      children: runs.length > 0 ? runs : [new TextRun({ text: '' })],
      alignment: style.align,
    }),
  ];
}

function tableFromElement(tableEl: HTMLTableElement): Table {
  const rows = Array.from(
    tableEl.querySelectorAll(':scope > tbody > tr, :scope > thead > tr, :scope > tr'),
  );
  const normalizedRows = rows.length > 0 ? rows : Array.from(tableEl.rows);
  const colCount = Math.max(
    1,
    ...normalizedRows.map(
      (row) => Array.from(row.children).filter((c) => /^(td|th)$/i.test(c.tagName)).length,
    ),
  );
  const colWidth = Math.floor(9000 / colCount);

  const tableRows = normalizedRows.map((row) => {
    const cells = Array.from(row.children).filter((c) =>
      /^(td|th)$/i.test(c.tagName),
    ) as HTMLElement[];
    while (cells.length < colCount) {
      cells.push(document.createElement('td'));
    }

    return new TableRow({
      children: cells.slice(0, colCount).map((cell) => {
        const isHeader = cell.tagName.toLowerCase() === 'th';
        const style = parseInlineStyle(cell.getAttribute('style'));
        const shading = style.shading ?? (isHeader ? 'E2E8F0' : undefined);
        return new TableCell({
          width: { size: colWidth, type: WidthType.DXA },
          borders: {
            top: TABLE_BORDER,
            bottom: TABLE_BORDER,
            left: TABLE_BORDER,
            right: TABLE_BORDER,
          },
          shading: shading
            ? {
                type: ShadingType.CLEAR,
                fill: shading,
              }
            : undefined,
          children: cellParagraphs(cell),
        });
      }),
    });
  });

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows:
      tableRows.length > 0
        ? tableRows
        : [
            new TableRow({
              children: [
                new TableCell({
                  borders: {
                    top: NO_BORDER,
                    bottom: NO_BORDER,
                    left: NO_BORDER,
                    right: NO_BORDER,
                  },
                  children: [new Paragraph({ children: [new TextRun({ text: '' })] })],
                }),
              ],
            }),
          ],
  });
}

function convertNode(node: Node, out: DocChild[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) out.push(new Paragraph({ children: [new TextRun({ text })] }));
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'meta' || tag === 'link') {
    return;
  }

  if (tag === 'table') {
    out.push(tableFromElement(el as HTMLTableElement));
    out.push(new Paragraph({ children: [] }));
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(el.children).filter(
      (child) => child.tagName.toLowerCase() === 'li',
    ) as HTMLElement[];
    items.forEach((item, index) => {
      const prefix = tag === 'ol' ? `${index + 1}. ` : '• ';
      const runs: TextRun[] = [new TextRun({ text: prefix })];
      collectTextRuns(item, parseInlineStyle(item.getAttribute('style')), runs);
      out.push(new Paragraph({ children: runs, spacing: { after: 80 } }));
    });
    return;
  }

  if (tag === 'p' || tag.startsWith('h') || tag === 'blockquote' || tag === 'pre') {
    out.push(paragraphFromElement(el));
    return;
  }

  if (tag === 'br') {
    out.push(new Paragraph({ children: [] }));
    return;
  }

  if (tag === 'hr') {
    out.push(
      new Paragraph({
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 },
        },
        spacing: { after: 200 },
        children: [],
      }),
    );
    return;
  }

  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'span') {
    const blockChildren = Array.from(el.childNodes);
    const hasBlock = blockChildren.some(
      (child) =>
        child.nodeType === Node.ELEMENT_NODE &&
        /^(p|h[1-6]|table|ul|ol|div|section|article|blockquote|pre|hr)$/i.test(
          (child as Element).tagName,
        ),
    );
    if (hasBlock) {
      for (const child of blockChildren) convertNode(child, out);
      return;
    }
    out.push(paragraphFromElement(el));
    return;
  }

  for (const child of Array.from(el.childNodes)) {
    convertNode(child, out);
  }
}

/** Convert Gemini layout HTML into a styled DOCX blob (client-side via `docx`). */
export async function htmlToDocxBlob(html: string, title?: string): Promise<Blob> {
  const wrapped = `<div id="gsm-root">${html}</div>`;
  const parsed = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = parsed.getElementById('gsm-root') ?? parsed.body;

  const children: DocChild[] = [];
  for (const child of Array.from(root.childNodes)) {
    convertNode(child, children);
  }

  if (children.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'No content detected.' })],
      }),
    );
  }

  const document = new Document({
    title: title || 'GramSeva Mitra Export',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
