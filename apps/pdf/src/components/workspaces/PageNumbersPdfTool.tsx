import { useCallback, useMemo, useState } from 'react';
import { ActionButton, FileDropZone, StatusMessage } from './ToolWorkspaceShell';
import { useToolProgress } from './ToolProgressContext';
import VisualPositionPreview from '../shared/VisualPositionPreview';
import FontFamilySelect from '../shared/FontFamilySelect';
import RadioGroup from '../shared/RadioGroup';
import { usePdfDocument } from '../../hooks/usePdfDocument';
import { downloadBytes } from '../../lib/pdfEngine';
import type {
  OverlayMargins,
  PageNumberFormat,
  PageNumberHorizontal,
  PageNumberVertical,
  WatermarkFontFamily,
} from '../../lib/overlayPosition';
import {
  DEFAULT_OVERLAY_MARGINS,
  formatPageNumber,
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_HORIZONTAL_OPTIONS,
  PAGE_NUMBER_VERTICAL_OPTIONS,
} from '../../lib/overlayPosition';
import { runPdfWorkerWithStreamedFile } from '../../lib/pdfWorkerClient';

export default function PageNumbersPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [vertical, setVertical] = useState<PageNumberVertical>('bottom');
  const [horizontal, setHorizontal] = useState<PageNumberHorizontal>('center');
  const [format, setFormat] = useState<PageNumberFormat>('plain');
  const [color, setColor] = useState('#333333');
  const [fontSize, setFontSize] = useState(11);
  const [fontFamily, setFontFamily] = useState<WatermarkFontFamily>('Helvetica');
  const [margins, setMargins] = useState<OverlayMargins>({ ...DEFAULT_OVERLAY_MARGINS });
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { pdf, loading, error: pdfError } = usePdfDocument(file);
  const { report, resetProgress } = useToolProgress();

  const previewTotal = pdf?.numPages ?? 12;
  const previewText = useMemo(
    () => formatPageNumber(format, 1, previewTotal),
    [format, previewTotal]
  );

  const run = useCallback(async () => {
    if (!file) {
      setError('Please select a PDF.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const out = await runPdfWorkerWithStreamedFile<Uint8Array>(
        'add-page-numbers',
        file,
        {
          vertical,
          horizontal,
          format,
          color,
          fontSize,
          fontFamily,
          margins,
          offsetX,
          offsetY,
        },
        ({ current, total, label }) => report(current, total, label)
      );
      downloadBytes(out, file.name, 'application/pdf', '_numbered');
      setSuccess('Page numbers added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add page numbers.');
    } finally {
      resetProgress();
      setBusy(false);
    }
  }, [
    file,
    vertical,
    horizontal,
    format,
    color,
    fontSize,
    fontFamily,
    margins,
    offsetX,
    offsetY,
    report,
    resetProgress,
  ]);

  const marginField = (key: keyof OverlayMargins, label: string) => (
    <label key={key} className="block">
      <span className="label text-emerald-200">{label}</span>
      <input
        type="number"
        min={0}
        max={200}
        value={margins[key]}
        onChange={(e) => setMargins((m) => ({ ...m, [key]: Number(e.target.value) }))}
        className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <FileDropZone
        accept="application/pdf"
        label="Select PDF to add page numbers"
        onFiles={(f) => setFile(f[0] ?? null)}
      />

      {file && (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
          <aside className="relative z-40 space-y-4 overflow-visible rounded-xl border border-emerald-900/40 bg-slate-950/50 p-4">
            <label className="relative isolate z-50 block overflow-visible">
              <span className="label text-emerald-200">Numbering format</span>
              <div className="relative z-50 overflow-visible">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as PageNumberFormat)}
                className="select-field border-emerald-800/60 bg-slate-900 focus:border-emerald-400"
              >
                {PAGE_NUMBER_FORMATS.map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-slate-100">
                    {f.label}
                  </option>
                ))}
              </select>
              </div>
            </label>

            <div className="border-t border-emerald-900/40 pt-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Placement</p>
              <div className="space-y-4">
                <RadioGroup
                  name="page-number-vertical"
                  label="Position"
                  value={vertical}
                  options={PAGE_NUMBER_VERTICAL_OPTIONS}
                  onChange={setVertical}
                />
                <RadioGroup
                  name="page-number-horizontal"
                  label="Horizontal alignment"
                  value={horizontal}
                  options={PAGE_NUMBER_HORIZONTAL_OPTIONS}
                  onChange={setHorizontal}
                />
              </div>
            </div>

            <div className="border-t border-emerald-900/40 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Typography</p>
              <label className="block">
                <span className="label text-emerald-200">Color</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-emerald-800/60 bg-transparent"
                />
              </label>
              <div className="mt-3">
                <span className="label text-emerald-200">Font family</span>
                <FontFamilySelect value={fontFamily} onChange={setFontFamily} />
              </div>
              <label className="mt-3 block">
                <span className="label text-emerald-200">Text size ({fontSize} pt)</span>
                <input
                  type="range"
                  min={8}
                  max={36}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </label>
            </div>

            <div className="border-t border-emerald-900/40 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Margins (PostScript points)
              </p>
              <div className="grid grid-cols-2 gap-3">
                {marginField('top', 'Top')}
                {marginField('bottom', 'Bottom')}
                {marginField('left', 'Left')}
                {marginField('right', 'Right')}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label text-emerald-200">Fine-tune X (pt)</span>
                  <input
                    type="number"
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.target.value))}
                    className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="label text-emerald-200">Fine-tune Y (pt)</span>
                  <input
                    type="number"
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.target.value))}
                    className="input-field border-emerald-800/60 bg-[#064e3b]/20 focus:border-emerald-400"
                  />
                </label>
              </div>
            </div>
          </aside>

          <VisualPositionPreview
            pdf={pdf}
            loading={loading}
            overlayType="page-number"
            position="bottom-center"
            onPositionChange={() => {}}
            pageNumber={{
              text: previewText,
              color,
              fontSize,
              fontFamily,
              vertical,
              horizontal,
              offsetX,
              offsetY,
            }}
          />
        </div>
      )}

      <ActionButton onClick={run} disabled={busy || !file}>
        {busy ? 'Processing…' : 'Add Numbers & Download'}
      </ActionButton>
      <StatusMessage error={pdfError ?? error} success={success} />
    </div>
  );
}
