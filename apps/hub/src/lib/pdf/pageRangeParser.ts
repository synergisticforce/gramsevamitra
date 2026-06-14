/** Parse ILovePDF-style page ranges (1-based) into sorted unique 0-based indices. */
export function parsePageRange(input: string, maxPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Enter a page range (e.g. 1-3, 5).');
  }

  const pages = new Set<number>();

  for (const segment of trimmed.split(',')) {
    const part = segment.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const bounds = part.split('-').map((s) => s.trim());
      if (bounds.length !== 2) {
        throw new Error(`Invalid range "${part}". Use formats like 1-3 or 5.`);
      }
      const start = Number(bounds[0]);
      const end = Number(bounds[1]);
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1) {
        throw new Error(`Invalid range "${part}". Page numbers must be positive integers.`);
      }
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let page = lo; page <= hi; page++) {
        if (page > maxPages) {
          throw new Error(`Page ${page} is out of range. This PDF has ${maxPages} page(s).`);
        }
        pages.add(page);
      }
    } else {
      const page = Number(part);
      if (!Number.isInteger(page) || page < 1) {
        throw new Error(`Invalid page "${part}". Use positive integers.`);
      }
      if (page > maxPages) {
        throw new Error(`Page ${page} is out of range. This PDF has ${maxPages} page(s).`);
      }
      pages.add(page);
    }
  }

  if (pages.size === 0) {
    throw new Error('No valid pages found in that range.');
  }

  return [...pages].sort((a, b) => a - b).map((p) => p - 1);
}
