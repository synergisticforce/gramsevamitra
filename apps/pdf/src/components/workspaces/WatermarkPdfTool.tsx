import { useCallback, useEffect, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPositionPreview from '../shared/VisualPositionPreview';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes } from '../../lib/pdfEngine';
import FontFamilySelect from '../shared/FontFamilySelect';
import type { OverlayPosition, WatermarkFontFamily, WatermarkLayer } from '../../lib/overlayPosition';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

type WatermarkMode = 'text' | 'image';

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-emerald-900/60 bg-slate-950/60 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
            value === opt.id
              ? 'bg-[#064e3b] text-emerald-300 shadow-sm'
              : 'text-slate-400 hover:text-emerald-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function WatermarkPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<WatermarkMode>('text');
  const [text, setText] = useState('DRAFT');
  const [color, setColor] = useState('#064e3b');
  const [fontSize, setFontSize] = useState(36);
  const [fontFamily, setFontFamily] = useState<WatermarkFontFamily>('Helvetica');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(35);
  const [position, setPosition] = useState<OverlayPosition>('center');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [rotation, setRotation] = useState(-30);
  const [opacity, setOpacity] = useState(0.2);
  const [layer, setLayer] = useState<WatermarkLayer>('over');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { pdf, loading, error: pdfError } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const onLogoFiles = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) {
      setLogoFile(null);
      return;
    }
    const ok =
      f.type === 'image/png' ||
      f.type === 'image/jpeg' ||
      /\.(png|jpe?g)$/i.test(f.name);
    if (!ok) {
      setError('Logo must be PNG or JPG/JPEG only.');
      return;
    }
    setError(null);
    setLogoFile(f);
  }, []);

  const run = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }
    if (mode === 'text' && !text.trim()) {
      setError('Enter watermark text.');
      return;
    }
    if (mode === 'image' && !logoFile) {
      setError('Upload a PNG or JPG logo.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      let imageBytes: ArrayBuffer | undefined;
      let imageKind: 'png' | 'jpg' | undefined;
      if (mode === 'image' && logoFile) {
        imageBytes = await logoFile.arrayBuffer();
        imageKind = logoFile.type === 'image/png' || /\.png$/i.test(logoFile.name) ? 'png' : 'jpg';
      }

      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'watermark',
        file,
        {
          mode,
          text: text.trim(),
          color,
          fontSize,
          fontFamily,
          imageBytes,
          imageKind,
          imageScale,
          position,
          offsetX,
          offsetY,
          rotation,
          opacity,
          layer,
        },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_watermarked');
      setSuccess('Watermark applied.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watermark failed.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [
    file,
    mode,
    text,
    color,
    fontSize,
    fontFamily,
    logoFile,
    imageScale,
    position,
    offsetX,
    offsetY,
    rotation,
    opacity,
    layer,
    report,
    resetProgress,
  ]);

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to watermark"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {file && (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <aside className="relative z-40 space-y-4 overflow-visible rounded-xl border border-emerald-900/40 bg-slate-950/50 p-4">
            <SegmentedControl
              value={mode}
              options={[
                { id: 'text', label: 'Text Watermark' },
                { id: 'image', label: 'Logo / Image' },
              ]}
              onChange={setMode}
            />

            {mode === 'text' ? (
              <>
                <label className="block">
                  <span className="label text-emerald-200">Watermark text</span>
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
                    placeholder="DRAFT"
                  />
                </label>
                <label className="block">
                  <span className="label text-emerald-200">Color</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-emerald-800/60 bg-transparent"
                  />
                </label>
                <label className="block">
                  <span className="label text-emerald-200">Font size ({fontSize} pt)</span>
                  <input
                    type="range"
                    min={12}
                    max={96}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </label>
                <div>
                  <span className="label text-emerald-200">Font family</span>
                  <FontFamilySelect value={fontFamily} onChange={setFontFamily} />
                </div>
              </>
            ) : (
              <>
                <FileDropZone
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  label="Upload logo (PNG or JPG only)"
                  onFiles={onLogoFiles}
                />
                <label className="block">
                  <span className="label text-emerald-200">Image scale ({imageScale}% of page width)</span>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={imageScale}
                    onChange={(e) => setImageScale(Number(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </label>
              </>
            )}

            <div className="border-t border-emerald-900/40 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Position &amp; style</p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label text-emerald-200">Offset X (pt)</span>
                  <input
                    type="number"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="label text-emerald-200">Offset Y (pt)</span>
                  <input
                    type="number"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="label text-emerald-200">Rotation ({rotation}°)</span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </label>
              <label className="mt-3 block">
                <span className="label text-emerald-200">Opacity ({Math.round(opacity * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-emerald-500"
                />
              </label>
              <label className="relative z-50 mt-3 block overflow-visible">
                <span className="label text-emerald-200">Layer stacking</span>
                <select
                  value={layer}
                  onChange={(e) => setLayer(e.target.value as WatermarkLayer)}
                  className="select-field border-emerald-800/60 bg-slate-900 focus:border-emerald-400"
                >
                  <option value="over" className="bg-slate-900 text-slate-100">
                    Place over document content
                  </option>
                  <option value="under" className="bg-slate-900 text-slate-100">
                    Place under document content
                  </option>
                </select>
              </label>
            </div>
          </aside>

          <VisualPositionPreview
            pdf={pdf}
            loading={loading}
            overlayType="watermark"
            position={position}
            onPositionChange={setPosition}
            watermark={{
              mode,
              text: text.trim(),
              color,
              fontSize,
              fontFamily,
              imageUrl: logoPreviewUrl,
              imageScale,
              rotation,
              opacity,
              offsetX,
              offsetY,
            }}
          />
        </div>
      )}

      <ActionButton onClick={run} disabled={busy || !file}>
        {busy ? 'Applying…' : 'Apply Watermark & Download'}
      </ActionButton>
      <StatusMessage error={pdfError ?? error} success={success} />
    </div>
  );
}
