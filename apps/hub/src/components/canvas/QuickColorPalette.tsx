import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  generateAllHarmoniesFromHex,
  type ColorSwatch,
  type PaletteHarmony,
} from '../../lib/design/colorEngine';

interface FormState {
  baseHex: string;
}

const DEFAULTS: FormState = { baseHex: '#6366F1' };

const HARMONY_LABELS: { id: PaletteHarmony; label: string }[] = [
  { id: 'complementary', label: 'Complementary' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'triadic', label: 'Triadic' },
];

interface Props {
  onToast: (message: string) => void;
}

function SwatchRow({
  label,
  swatches,
  onCopy,
}: {
  label: string;
  swatches: ColorSwatch[];
  onCopy: (hex: string) => void;
}) {
  if (swatches.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {swatches.map((swatch, idx) => (
          <button
            key={`${swatch.hex}-${idx}`}
            type="button"
            onClick={() => onCopy(swatch.hex)}
            className="group flex min-h-[88px] flex-col justify-end overflow-hidden rounded-xl border border-slate-200 shadow-sm transition hover:scale-[1.02] hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-400"
            style={{ backgroundColor: swatch.hex }}
            title={`Copy ${swatch.hex}`}
          >
            <div className="bg-black/45 px-2 py-1.5 text-left backdrop-blur-sm">
              <p className="font-mono text-[10px] font-bold text-white">{swatch.hex}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QuickColorPalette({ onToast }: Props) {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.colorPalette, DEFAULTS),
    []
  );
  const [baseHex, setBaseHex] = useState(initial.baseHex);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.colorPalette, { baseHex });
  }, [baseHex]);

  const palettes = useMemo(() => generateAllHarmoniesFromHex(baseHex), [baseHex]);
  const isValid = palettes.complementary.length > 0;

  const copyHex = useCallback(
    async (hex: string) => {
      try {
        await navigator.clipboard.writeText(hex);
        onToast(`Copied ${hex}`);
      } catch {
        onToast('Copy failed — select and copy manually.');
      }
    },
    [onToast]
  );

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm uppercase outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Base color</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block flex-1 min-w-[140px]">
            <span className="text-sm font-medium text-slate-700">Hex code</span>
            <input
              type="text"
              value={baseHex}
              onChange={(e) => setBaseHex(e.target.value)}
              placeholder="#6366F1"
              className={`${inputClass} mt-1.5`}
              spellCheck={false}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Picker</span>
            <input
              type="color"
              value={isValid ? baseHex : '#6366F1'}
              onChange={(e) => setBaseHex(e.target.value.toUpperCase())}
              className="mt-1.5 h-11 w-full min-w-[3rem] cursor-pointer rounded-xl border border-slate-200 bg-white"
            />
          </label>
        </div>
        {!isValid && (
          <p className="mt-2 text-sm text-rose-600">Enter a valid 6-digit hex code (e.g. #6366F1).</p>
        )}
      </section>

      {isValid && (
        <div className="space-y-6">
          {HARMONY_LABELS.map(({ id, label }) => (
            <SwatchRow key={id} label={label} swatches={palettes[id]} onCopy={(hex) => void copyHex(hex)} />
          ))}
          <button
            type="button"
            onClick={() =>
              void copyHex(
                [...palettes.complementary, ...palettes.analogous, ...palettes.triadic]
                  .map((s) => s.hex)
                  .join(', ')
              )
            }
            className="w-full rounded-xl border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100"
          >
            Copy all hex values
          </button>
        </div>
      )}
    </div>
  );
}
