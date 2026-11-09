import { PDFDocument } from '@cantoo/pdf-lib';

const POINT = 72;
export const THERMAL_WIDTH = 4 * POINT;
export const THERMAL_HEIGHT = 6 * POINT;

/**
 * @param {number} lengthCm
 * @param {number} breadthCm
 * @param {number} heightCm
 * @param {number} deadWeightGrams
 */
export function courierSlab(lengthCm, breadthCm, heightCm, deadWeightGrams) {
  const volumetricGrams = Math.round((lengthCm * breadthCm * heightCm * 1000) / 5000);
  const dead = Math.max(0, Math.trunc(deadWeightGrams));
  const chargeableGrams = Math.max(volumetricGrams, dead);
  const band = (grams) => (grams <= 500 ? 500 : grams <= 1000 ? 1000 : 1001);
  const deadBand = band(dead);
  const chargeBand = band(chargeableGrams);
  const slabGrams = chargeableGrams <= 500 ? 500 : Math.ceil(chargeableGrams / 500) * 500;
  const steps = Math.max(1, slabGrams / 500);
  const forwardPaise = 4000 + (steps - 1) * 2000;
  return {
    volumetricGrams,
    chargeableGrams,
    slabGrams,
    slabJump: chargeBand > deadBand,
    slabLabel: chargeBand > 1000 ? '1000g+' : `${chargeBand}g`,
    forwardPaise,
    rtoPaise: forwardPaise,
  };
}

/**
 * @param {Uint8Array | ArrayBuffer} pdfBytes
 */
export async function cropPdfTo4x6Labels(pdfBytes) {
  const source = await PDFDocument.load(pdfBytes);
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, source.getPageIndices());
  for (const page of pages) {
    const { width, height } = page.getSize();
    const cropWidth = Math.min(THERMAL_WIDTH, width);
    const cropHeight = Math.min(THERMAL_HEIGHT, height);
    const bottom = Math.max(0, height - cropHeight);
    page.setCropBox(0, bottom, cropWidth, cropHeight);
    page.setMediaBox(0, bottom, cropWidth, cropHeight);
    output.addPage(page);
  }
  return output.save();
}
