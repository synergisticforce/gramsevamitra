/** Pay stub document builder — plain-text layout + PDF export. */

import { downloadBlob } from '@shared/utils/fileUtils';
import { formatInr } from './formatInr';

export interface PayStubLine {
  id: string;
  label: string;
  amount: number;
}

export interface PayStubFormData {
  employerName: string;
  employeeName: string;
  employeeId: string;
  payPeriod: string;
  payDate: string;
  earnings: PayStubLine[];
  deductions: PayStubLine[];
}

export function createPayStubLineId(): string {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_PAY_STUB: PayStubFormData = {
  employerName: 'Employer Pvt Ltd',
  employeeName: 'Employee Name',
  employeeId: 'EMP-001',
  payPeriod: 'March 2026',
  payDate: new Date().toISOString().slice(0, 10),
  earnings: [
    { id: createPayStubLineId(), label: 'Basic salary', amount: 50_000 },
    { id: createPayStubLineId(), label: 'HRA', amount: 20_000 },
  ],
  deductions: [
    { id: createPayStubLineId(), label: 'Employee PF', amount: 6_000 },
    { id: createPayStubLineId(), label: 'Professional tax', amount: 200 },
  ],
};

export function computePayStubTotals(data: PayStubFormData): {
  grossPay: number;
  totalDeductions: number;
  netPay: number;
} {
  const grossPay = data.earnings.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  const totalDeductions = data.deductions.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
  return { grossPay, totalDeductions, netPay: grossPay - totalDeductions };
}

export function buildPayStubText(data: PayStubFormData): string {
  const { grossPay, totalDeductions, netPay } = computePayStubTotals(data);
  const earningsLines = data.earnings
    .map((row) => `  ${row.label.padEnd(24).slice(0, 24)}  ${formatInr(row.amount).padStart(12)}`)
    .join('\n');
  const deductionLines = data.deductions
    .map((row) => `  ${row.label.padEnd(24).slice(0, 24)}  ${formatInr(row.amount).padStart(12)}`)
    .join('\n');

  return `PAY STUB / SALARY SLIP

Employer: ${data.employerName}
Employee: ${data.employeeName} (${data.employeeId})
Pay period: ${data.payPeriod}
Pay date: ${data.payDate}

EARNINGS
${earningsLines || '  —'}
Gross pay: ${formatInr(grossPay)}

DEDUCTIONS
${deductionLines || '  —'}
Total deductions: ${formatInr(totalDeductions)}

NET PAY: ${formatInr(netPay)}

This is a generated record for personal reference only — not an official employer document.`.trim();
}

export async function exportPayStubPdf(data: PayStubFormData): Promise<Blob> {
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const text = buildPayStubText(data);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 48;
  let y = page.getHeight() - margin;

  page.drawText('PAY STUB', { x: margin, y, size: 18, font: bold, color: rgb(0.05, 0.45, 0.35) });
  y -= 28;

  for (const line of text.split('\n').slice(1)) {
    if (y < margin) break;
    page.drawText(line.slice(0, 90), { x: margin, y, size: fontSize, font, color: rgb(0.15, 0.15, 0.2) });
    y -= lineHeight;
  }

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export function triggerPayStubDownload(blob: Blob, employeeName: string): void {
  const slug = employeeName.replace(/[^\w-]/g, '-').slice(0, 30) || 'paystub';
  downloadBlob(blob, `${slug}-paystub.pdf`, '_paystub');
}
