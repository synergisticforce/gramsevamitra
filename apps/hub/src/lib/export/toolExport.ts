export function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\n');
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyTextWithFeedback(
  text: string,
  btn: HTMLButtonElement,
  labels: { default: string; success?: string; fail?: string } = { default: 'Copy' },
): Promise<boolean> {
  const success = labels.success ?? 'Copied!';
  const fail = labels.fail ?? 'Copy failed';
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = success;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original ?? labels.default;
      btn.disabled = false;
    }, 2000);
    return true;
  } catch {
    btn.textContent = fail;
    setTimeout(() => {
      btn.textContent = labels.default;
    }, 2000);
    return false;
  }
}

export function bindExportButtons(options: {
  copyBtn: HTMLButtonElement;
  csvBtn: HTMLButtonElement;
  getSummary: () => string | null;
  getCsv: () => { filename: string; headers: string[]; rows: (string | number)[][] } | null;
  copyLabel?: string;
  csvLabel?: string;
}): void {
  const {
    copyBtn,
    csvBtn,
    getSummary,
    getCsv,
    copyLabel = 'Copy summary',
    csvLabel = 'Download CSV',
  } = options;

  copyBtn.textContent = copyLabel;
  csvBtn.textContent = csvLabel;

  copyBtn.addEventListener('click', () => {
    const summary = getSummary();
    if (!summary) return;
    void copyTextWithFeedback(summary, copyBtn, { default: copyLabel });
  });

  csvBtn.addEventListener('click', () => {
    const payload = getCsv();
    if (!payload) return;
    const content = buildCsv(payload.headers, payload.rows);
    downloadCsv(payload.filename, content);
    const original = csvBtn.textContent;
    csvBtn.textContent = 'Downloaded!';
    setTimeout(() => {
      csvBtn.textContent = original ?? csvLabel;
    }, 2000);
  });
}
