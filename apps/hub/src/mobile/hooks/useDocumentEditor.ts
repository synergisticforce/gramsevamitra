import { useCallback } from 'react';

export interface EditorHookResult {
  addWatermark: (sourceBlob: Blob, text: string) => Promise<Blob>;
  addSignature: (sourceBlob: Blob, signatureBlob: Blob) => Promise<Blob>;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image for document editing.'));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to export edited document.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function addWatermarkImpl(sourceBlob: Blob, text: string): Promise<Blob> {
  const image = await loadImageFromBlob(sourceBlob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas for watermark.');
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const stamp = text.trim() || 'CONFIDENTIAL';
  const fontSize = Math.max(18, Math.round(canvas.width * 0.045));
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stamp, 0, 0);
  ctx.restore();

  return canvasToJpegBlob(canvas);
}

async function addSignatureImpl(sourceBlob: Blob, signatureBlob: Blob): Promise<Blob> {
  const [source, signature] = await Promise.all([
    loadImageFromBlob(sourceBlob),
    loadImageFromBlob(signatureBlob),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth || source.width;
  canvas.height = source.naturalHeight || source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas for signature overlay.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const maxSigWidth = canvas.width * 0.28;
  const maxSigHeight = canvas.height * 0.14;
  const scale = Math.min(
    maxSigWidth / (signature.naturalWidth || 1),
    maxSigHeight / (signature.naturalHeight || 1),
  );
  const sigWidth = (signature.naturalWidth || 1) * scale;
  const sigHeight = (signature.naturalHeight || 1) * scale;
  const pad = Math.max(12, Math.round(canvas.width * 0.03));
  const x = canvas.width - sigWidth - pad;
  const y = canvas.height - sigHeight - pad;

  ctx.drawImage(signature, x, y, sigWidth, sigHeight);
  return canvasToJpegBlob(canvas);
}

export function useDocumentEditor(): EditorHookResult {
  const addWatermark = useCallback((sourceBlob: Blob, text: string) => {
    return addWatermarkImpl(sourceBlob, text);
  }, []);

  const addSignature = useCallback((sourceBlob: Blob, signatureBlob: Blob) => {
    return addSignatureImpl(sourceBlob, signatureBlob);
  }, []);

  return { addWatermark, addSignature };
}
