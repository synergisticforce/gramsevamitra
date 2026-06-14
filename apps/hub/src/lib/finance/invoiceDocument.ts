/** Invoice document builder — plain-text layout + PDF export. */

import { downloadBlob } from '@shared/utils/fileUtils';
import { formatInr } from './formatInr';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceFormData {
  businessName: string;
  businessEmail: string;
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  taxPercent: number;
  notes: string;
  lineItems: InvoiceLineItem[];
}

export function createLineItemId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_INVOICE: InvoiceFormData = {
  businessName: 'GramSeva Freelancer',
  businessEmail: 'you@example.com',
  clientName: 'Client Name',
  clientEmail: 'client@example.com',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: '',
  taxPercent: 18,
  notes: 'Payment due within 15 days. Thank you for your business.',
  lineItems: [
    { id: createLineItemId(), description: 'Professional services', quantity: 1, unitPrice: 25_000 },
  ],
};

export function computeInvoiceTotals(data: InvoiceFormData): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = data.lineItems.reduce(
    (sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice),
    0
  );
  const tax = subtotal * (Math.max(0, data.taxPercent) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export function buildInvoiceText(data: InvoiceFormData): string {
  const { subtotal, tax, total } = computeInvoiceTotals(data);
  const lines = data.lineItems
    .map(
      (item) =>
        `  ${item.description.padEnd(28).slice(0, 28)}  ${String(item.quantity).padStart(4)}  ${formatInr(item.unitPrice).padStart(12)}  ${formatInr(item.quantity * item.unitPrice).padStart(12)}`
    )
    .join('\n');

  return `INVOICE
Invoice #: ${data.invoiceNumber}
Date: ${data.invoiceDate}${data.dueDate ? `\nDue: ${data.dueDate}` : ''}

FROM:
${data.businessName}
${data.businessEmail}

BILL TO:
${data.clientName}
${data.clientEmail}

DESCRIPTION                      QTY      UNIT PRICE        AMOUNT
${lines}

Subtotal: ${formatInr(subtotal)}
Tax (${data.taxPercent}%): ${formatInr(tax)}
TOTAL DUE: ${formatInr(total)}

${data.notes}`.trim();
}

export async function exportInvoicePdf(data: InvoiceFormData): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = buildInvoiceText(data);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 48;
  let y = page.getHeight() - margin;

  page.drawText('INVOICE', { x: margin, y, size: 18, font: bold, color: rgb(0.05, 0.45, 0.35) });
  y -= 28;

  for (const line of text.split('\n').slice(1)) {
    if (y < margin) break;
    page.drawText(line.slice(0, 90), { x: margin, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.2) });
    y -= lineHeight;
  }

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export function triggerInvoiceDownload(blob: Blob, invoiceNumber: string): void {
  const slug = invoiceNumber.replace(/[^\w-]/g, '') || 'invoice';
  downloadBlob(blob, `${slug}.pdf`, '_invoice');
}
