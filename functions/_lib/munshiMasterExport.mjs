import * as XLSX from 'xlsx';

/**
 * @param {unknown} paise
 */
function rupees(paise) {
  const value = Math.trunc(Number(paise) || 0);
  const negative = value < 0;
  const abs = Math.abs(value);
  return `${negative ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * @param {Record<string, unknown>} client
 */
function clientRow(client) {
  const statement = client.statement || {};
  const tax = client.tax || {};
  const gross = Number(statement.declaredSummaryNetPayoutPaise || client.recoverablePaise || 0);
  const fees = Number(tax.totalPlatformFeesPaise || 0);
  const gst = Number(tax.gstr2bInputTaxCredit18PctPaise || 0);
  const tds = Number(tax.form26asTds194OPaise || 0);
  const tcs = Number(tax.gstr8TcsSec52Paise || 0);
  const net = Number(statement.declaredSummaryNetPayoutPaise || 0);
  return {
    clientName: String(client.fileName || client.platform || 'Client'),
    platform: String(client.platform || ''),
    utr: String(statement.bankUtr || ''),
    gross,
    fees,
    gst,
    tds,
    tcs,
    net,
    recoverable: Number(client.recoverablePaise || 0),
    munshiCut: Number(client.munshiCutPaise || 0),
  };
}

/**
 * @param {Array<Record<string, unknown>>} clients
 */
export function buildMasterTallyCsv(clients) {
  const header = ['Client Name', 'Platform', 'UTR', 'Gross Sales', 'Platform Fees', '18% GST ITC', 'TDS 194-O', 'TCS', 'Net Bank Settlement'];
  const lines = [header.join(',')];
  for (const client of clients) {
    const row = clientRow(client);
    lines.push([
      csv(row.clientName),
      csv(row.platform),
      csv(row.utr),
      rupees(row.gross),
      rupees(row.fees),
      rupees(row.gst),
      rupees(row.tds),
      rupees(row.tcs),
      rupees(row.net),
    ].join(','));
  }
  return lines.join('\n');
}

/**
 * @param {Array<Record<string, unknown>>} clients
 */
export function buildMasterCaWorkbook(clients) {
  const rows = [['Client', 'Platform', 'Total Payout', 'Recoverable Leakage', 'Tax Credits', 'Munshi 30%']];
  for (const client of clients) {
    const row = clientRow(client);
    rows.push([
      row.clientName,
      row.platform,
      rupees(row.net || row.gross),
      rupees(row.recoverable),
      rupees(row.gst + row.tds + row.tcs),
      rupees(row.munshiCut),
    ]);
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'All clients');
  return XLSX.write(book, { type: 'array', bookType: 'xlsx' });
}

/**
 * @param {string} value
 */
function csv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
