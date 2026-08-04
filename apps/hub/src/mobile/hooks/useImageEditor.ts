import { useCallback, useState } from 'react';

export interface ImageAdjustmentValues {
  brightness: number;
  contrast: number;
  saturation: number;
}

const DEFAULT_ADJUSTMENTS: ImageAdjustmentValues = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

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
      reject(new Error('Failed to decode image for editing.'));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to export edited photo.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function applyAdjustmentsImpl(
  sourceBlob: Blob,
  values: ImageAdjustmentValues,
): Promise<Blob> {
  const image = await loadImageFromBlob(sourceBlob);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas for image adjustments.');
  }

  ctx.filter = `brightness(${values.brightness}%) contrast(${values.contrast}%) saturate(${values.saturation}%)`;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';

  return canvasToJpegBlob(canvas);
}

export function useImageEditor() {
  const [values, setValues] = useState<ImageAdjustmentValues>(DEFAULT_ADJUSTMENTS);

  const setBrightness = useCallback((brightness: number) => {
    setValues((current) => ({ ...current, brightness }));
  }, []);

  const setContrast = useCallback((contrast: number) => {
    setValues((current) => ({ ...current, contrast }));
  }, []);

  const setSaturation = useCallback((saturation: number) => {
    setValues((current) => ({ ...current, saturation }));
  }, []);

  const resetAdjustments = useCallback(() => {
    setValues(DEFAULT_ADJUSTMENTS);
  }, []);

  const applyAdjustments = useCallback(
    (sourceBlob: Blob, nextValues: ImageAdjustmentValues = values) => {
      return applyAdjustmentsImpl(sourceBlob, nextValues);
    },
    [values],
  );

  return {
    values,
    setBrightness,
    setContrast,
    setSaturation,
    resetAdjustments,
    applyAdjustments,
  };
}
