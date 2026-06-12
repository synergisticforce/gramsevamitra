import { useCallback, useEffect, useState } from 'react';
import {
  convertUnits,
  DEFAULT_UNITS,
  formatConverted,
  getUnit,
  UNIT_CATEGORIES,
  type UnitCategory,
} from '../../lib/convert/unitEngine';

export default function UnitConverterTool() {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [fromUnitId, setFromUnitId] = useState(DEFAULT_UNITS.length.from);
  const [toUnitId, setToUnitId] = useState(DEFAULT_UNITS.length.to);
  const [fromValue, setFromValue] = useState('1');
  const [toValue, setToValue] = useState('');
  const [activeSide, setActiveSide] = useState<'from' | 'to'>('from');

  const units = UNIT_CATEGORIES[category];

  const sync = useCallback(
    (side: 'from' | 'to', fromRaw: string, toRaw: string, fromId: string, toId: string, unitList = units) => {
      const fromU = getUnit(unitList, fromId);
      const toU = getUnit(unitList, toId);
      if (side === 'from') {
        const n = parseFloat(fromRaw);
        setToValue(Number.isFinite(n) ? formatConverted(convertUnits(n, fromU, toU)) : '');
      } else {
        const n = parseFloat(toRaw);
        setFromValue(Number.isFinite(n) ? formatConverted(convertUnits(n, toU, fromU)) : '');
      }
    },
    [units],
  );

  useEffect(() => {
    sync('from', fromValue, toValue, fromUnitId, toUnitId);
    // Initial conversion only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCategory = (next: UnitCategory) => {
    const defs = DEFAULT_UNITS[next];
    setCategory(next);
    setFromUnitId(defs.from);
    setToUnitId(defs.to);
    setFromValue('1');
    setActiveSide('from');
    const unitList = UNIT_CATEGORIES[next];
    sync('from', '1', '', defs.from, defs.to, unitList);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl sm:p-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Conversion category">
        {(['length', 'weight', 'temperature'] as UnitCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => switchCategory(cat)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
              category === cat
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:border-emerald-600 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="min-w-0 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">From</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={fromValue}
            onChange={(e) => {
              setActiveSide('from');
              setFromValue(e.target.value);
              sync('from', e.target.value, toValue, fromUnitId, toUnitId);
            }}
            className="input-field w-full tabular-nums"
          />
          <select
            value={fromUnitId}
            onChange={(e) => {
              setFromUnitId(e.target.value);
              sync(activeSide, fromValue, toValue, e.target.value, toUnitId);
            }}
            className="select-field mt-2 w-full"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden pb-3 text-center text-slate-500 sm:block" aria-hidden="true">
          ⇄
        </div>

        <label className="min-w-0 block">
          <span className="mb-1 block text-sm font-medium text-slate-300">To</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={toValue}
            onChange={(e) => {
              setActiveSide('to');
              setToValue(e.target.value);
              sync('to', fromValue, e.target.value, fromUnitId, toUnitId);
            }}
            className="input-field w-full tabular-nums"
          />
          <select
            value={toUnitId}
            onChange={(e) => {
              setToUnitId(e.target.value);
              sync(activeSide, fromValue, toValue, fromUnitId, e.target.value);
            }}
            className="select-field mt-2 w-full"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
