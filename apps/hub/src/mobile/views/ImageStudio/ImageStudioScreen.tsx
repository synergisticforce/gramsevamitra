import { useEffect, useMemo, useRef, useState } from 'react';
import BottomSlider from '../../components/BottomSlider';
import { useImageEditor } from '../../hooks/useImageEditor';
import { localVaultService } from '../../../shared/services/LocalVaultService';

export default function ImageStudioScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceBlob, setSourceBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('Edited_Photo.jpg');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    values,
    setBrightness,
    setContrast,
    setSaturation,
    resetAdjustments,
    applyAdjustments,
  } = useImageEditor();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const previewFilter = useMemo(
    () =>
      `brightness(${values.brightness}%) contrast(${values.contrast}%) saturate(${values.saturation}%)`,
    [values.brightness, values.contrast, values.saturation],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setSuccess(null);
    resetAdjustments();

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setSourceBlob(file);
    setPreviewUrl(url);
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'Edited_Photo');
  };

  const handleSaveToVault = async () => {
    if (!sourceBlob) {
      setError('Load a photo before saving.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const edited = await applyAdjustments(sourceBlob, values);
      await localVaultService.saveFile(edited, 'Edited_Photo.jpg', 'image/jpeg');
      setSuccess('Saved to Local Vault as Edited_Photo.jpg');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save edited photo.';
      console.warn('[ImageStudio] save failed:', message);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          Image Studio
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">Tune your photo</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Adjust brightness, contrast, and saturation with live preview — processed locally on-device.
        </p>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />

      <div className="overflow-hidden rounded-2xl border border-canvas-border bg-canvas-surface">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={fileName}
            className="mx-auto max-h-[48vh] w-full object-contain"
            style={{ filter: previewFilter }}
          />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 px-6 py-10 text-center"
          >
            <span className="text-4xl" aria-hidden="true">
              🖼️
            </span>
            <span className="text-sm font-semibold text-canvas-text">Tap to load a photo</span>
            <span className="text-xs font-medium text-slate-300">JPG, PNG, or WebP — stays on this device</span>
          </button>
        )}
      </div>

      {previewUrl && (
        <div className="space-y-4 rounded-2xl border border-canvas-border bg-canvas-surface px-4 py-4">
          <BottomSlider
            label="Brightness"
            value={values.brightness}
            min={50}
            max={150}
            onChange={setBrightness}
          />
          <BottomSlider
            label="Contrast"
            value={values.contrast}
            min={50}
            max={150}
            onChange={setContrast}
          />
          <BottomSlider
            label="Saturation"
            value={values.saturation}
            min={0}
            max={200}
            onChange={setSaturation}
          />
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center rounded-xl border border-canvas-border px-4 py-3 text-sm font-semibold text-canvas-muted transition hover:bg-canvas-elevated disabled:opacity-50"
        >
          {previewUrl ? 'Replace photo' : 'Load photo'}
        </button>
        <button
          type="button"
          onClick={() => void handleSaveToVault()}
          disabled={busy || !sourceBlob}
          className="inline-flex flex-1 items-center justify-center rounded-xl bg-canvas-accent-muted px-4 py-3 text-sm font-semibold text-canvas-text transition hover:bg-canvas-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save to Vault'}
        </button>
      </div>

      {error && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium text-rose-200"
          role="alert"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          className="rounded-xl border border-emerald-500/40 bg-canvas-accent-soft px-3 py-2 text-sm font-medium text-canvas-text"
          role="status"
        >
          {success}
        </p>
      )}
    </section>
  );
}
