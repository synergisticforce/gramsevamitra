import type { WatermarkFontFamily } from '../../lib/overlayPosition';
import { WATERMARK_FONT_FAMILIES } from '../../lib/overlayPosition';

interface FontFamilySelectProps {
  value: WatermarkFontFamily;
  onChange: (value: WatermarkFontFamily) => void;
  id?: string;
}

export default function FontFamilySelect({ value, onChange, id }: FontFamilySelectProps) {
  return (
    <div className="relative isolate z-50 overflow-visible">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as WatermarkFontFamily)}
        className="select-field border-emerald-800/60 bg-slate-900 focus:border-emerald-400"
        style={{ fontFamily: fontPreview(value) }}
      >
        {WATERMARK_FONT_FAMILIES.map((f) => (
          <option key={f.id} value={f.id} className="bg-slate-900 text-slate-100">
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function fontPreview(family: WatermarkFontFamily): string {
  switch (family) {
    case 'Times Roman':
      return '"Times New Roman", Times, serif';
    case 'Courier':
      return 'Courier, monospace';
    default:
      return 'Helvetica, Arial, sans-serif';
  }
}
