import { useMemo, useState } from 'react';
import { formatMinorUnits } from '../../lib/audit/currency';
import { courierSlab } from '../../lib/audit/sellerTools';

export default function QuickCourierSlabCalculator() {
  const [lengthCm, setLengthCm] = useState('25');
  const [breadthCm, setBreadthCm] = useState('20');
  const [heightCm, setHeightCm] = useState('12');
  const [deadGrams, setDeadGrams] = useState('450');

  const result = useMemo(
    () => courierSlab(Number(lengthCm) || 0, Number(breadthCm) || 0, Number(heightCm) || 0, Number(deadGrams) || 0),
    [lengthCm, breadthCm, heightCm, deadGrams],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-200">
          Length cm
          <input className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-bg px-3 py-2 text-white" inputMode="decimal" value={lengthCm} onChange={(event) => setLengthCm(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-slate-200">
          Breadth cm
          <input className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-bg px-3 py-2 text-white" inputMode="decimal" value={breadthCm} onChange={(event) => setBreadthCm(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-slate-200">
          Height cm
          <input className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-bg px-3 py-2 text-white" inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} />
        </label>
        <label className="text-sm font-semibold text-slate-200">
          Dead weight grams
          <input className="mt-1 w-full rounded-xl border border-canvas-border bg-canvas-bg px-3 py-2 text-white" inputMode="decimal" value={deadGrams} onChange={(event) => setDeadGrams(event.target.value)} />
        </label>
      </div>
      <div className={`rounded-2xl p-4 ${result.slabJump ? 'bg-amber-900/50' : 'bg-slate-900'}`}>
        <p>Volumetric weight {result.volumetricGrams} g</p>
        <p>Chargeable weight {result.chargeableGrams} g · slab {result.slabLabel}</p>
        {result.slabJump && <p className="font-bold text-amber-200">This parcel crosses a 500 g / 1,000 g slab.</p>}
        <p>Forward freight about {formatMinorUnits(result.forwardPaise)}</p>
        <p>RTO freight about {formatMinorUnits(result.rtoPaise)}</p>
      </div>
      <a className="block text-sm font-semibold text-canvas-accent underline" href="/seller/">
        Check the settlement on the seller hub
      </a>
    </div>
  );
}
