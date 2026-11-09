export declare const THERMAL_WIDTH: number;
export declare const THERMAL_HEIGHT: number;
export function courierSlab(
  lengthCm: number,
  breadthCm: number,
  heightCm: number,
  deadWeightGrams: number,
): {
  volumetricGrams: number;
  chargeableGrams: number;
  slabGrams: number;
  slabJump: boolean;
  slabLabel: string;
  forwardPaise: number;
  rtoPaise: number;
};
export function cropPdfTo4x6Labels(pdfBytes: Uint8Array | ArrayBuffer): Promise<Uint8Array>;
