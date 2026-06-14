/** Business card canvas renderer — standard 3.5×2 in at print resolution. */

import { downloadBlob } from '@shared/utils/fileUtils';

export const CAREER_BUSINESS_CARD_STORAGE_KEY = 'gsm-canvas-career:business-card';

/** 3.5 × 2 inches at 300 DPI */
export const CARD_WIDTH_PX = 1050;
export const CARD_HEIGHT_PX = 600;

export interface BusinessCardInput {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  accentColor: string;
}

export const DEFAULT_BUSINESS_CARD_INPUT: BusinessCardInput = {
  name: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  accentColor: '#0284c7',
};

export function loadBusinessCardInput(): BusinessCardInput {
  if (typeof window === 'undefined') return { ...DEFAULT_BUSINESS_CARD_INPUT };
  try {
    const raw = localStorage.getItem(CAREER_BUSINESS_CARD_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BUSINESS_CARD_INPUT };
    return { ...DEFAULT_BUSINESS_CARD_INPUT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BUSINESS_CARD_INPUT };
  }
}

export function saveBusinessCardInput(input: BusinessCardInput): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_BUSINESS_CARD_STORAGE_KEY, JSON.stringify(input));
  } catch {
    /* ignore */
  }
}

function safeHexColor(hex: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

export function renderBusinessCardCanvas(input: BusinessCardInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH_PX;
  canvas.height = CARD_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');

  const accent = safeHexColor(input.accentColor, '#0284c7');
  const name = input.name.trim() || 'Your Name';
  const title = input.title.trim() || 'Job Title';
  const company = input.company.trim() || 'Company';
  const email = input.email.trim();
  const phone = input.phone.trim();
  const website = input.website.trim();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_WIDTH_PX, CARD_HEIGHT_PX);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CARD_WIDTH_PX, 14);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, CARD_HEIGHT_PX);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(name, 72, 120);

  ctx.fillStyle = accent;
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText(title, 72, 175);

  ctx.fillStyle = '#475569';
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText(company, 72, 220);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(72, 260);
  ctx.lineTo(CARD_WIDTH_PX - 48, 260);
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = '400 26px system-ui, sans-serif';
  let y = 310;
  if (email) {
    ctx.fillText(`✉  ${email}`, 72, y);
    y += 44;
  }
  if (phone) {
    ctx.fillText(`☎  ${phone}`, 72, y);
    y += 44;
  }
  if (website) {
    ctx.fillText(`🌐  ${website.replace(/^https?:\/\//i, '')}`, 72, y);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 18px system-ui, sans-serif';
  ctx.fillText('gramsevamitra.in', CARD_WIDTH_PX - 220, CARD_HEIGHT_PX - 36);

  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to export business card PNG'))),
      'image/png',
      1
    );
  });
}

export async function exportBusinessCardPng(input: BusinessCardInput): Promise<Blob> {
  const canvas = renderBusinessCardCanvas(input);
  return canvasToPngBlob(canvas);
}

export async function exportBusinessCardPdf(input: BusinessCardInput): Promise<Blob> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const pngBlob = await exportBusinessCardPng(input);
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([3.5 * 72, 2 * 72]);
  const image = await pdf.embedPng(pngBytes);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: page.getWidth(),
    height: page.getHeight(),
  });

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

export function businessCardDownloadName(name: string, ext: 'png' | 'pdf'): string {
  const slug =
    name
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'business-card';
  return `${slug}.${ext}`;
}

export function triggerBusinessCardDownload(blob: Blob, filename: string): void {
  downloadBlob(blob, filename, '_bizcard');
}
