import { useMemo, useState } from 'react';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import { currencySymbol, informalCompoundAprPercent, informalSimpleAprPercent } from '../../../../../functions/_lib/livelihoodMath.mjs';

const PRESETS = [2, 3, 5];

export default function InformalInterestCard() {
  const prefs = useDisplayPrefs();
  const [monthly, setMonthly] = useState(2);
  const symbol = currencySymbol(prefs.currency);
  const simple = useMemo(() => informalSimpleAprPercent(monthly), [monthly]);
  const compound = useMemo(() => informalCompoundAprPercent(monthly), [monthly]);
  const extra = Math.max(0, simple - 12);

  return (
    <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-slate-900">
      <p className="text-xs font-black uppercase">Informal / moneylender interest trap</p>
      <h2 className="mt-1 text-xl font-black">2% a month is not a small loan</h2>
      <p className="mt-1 text-sm font-bold">1 Choose the monthly rate. 2 Read the true year rate. 3 Compare with a 12% bank or SHG loan.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((rate) => (
          <button key={rate} type="button" className="min-h-11 rounded-xl bg-white px-3 text-sm font-black" onClick={() => setMonthly(rate)}>
            {rate}% / month
          </button>
        ))}
      </div>
      <p className="mt-3 text-3xl font-black">{simple}% a year</p>
      <p className="text-sm font-bold">Compound year rate {compound}%. A {symbol}100 loan costs about {symbol}{extra.toFixed(0)} extra versus a 12% bank loan, before weekly collection.</p>
    </section>
  );
}
