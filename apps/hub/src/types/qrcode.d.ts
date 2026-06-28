declare module 'qrcode' {
  interface QrCodeToCanvasOptions {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: { dark?: string; light?: string };
  }

  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QrCodeToCanvasOptions,
  ): Promise<void>;

  export function toDataURL(text: string, options?: QrCodeToCanvasOptions): Promise<string>;
}
