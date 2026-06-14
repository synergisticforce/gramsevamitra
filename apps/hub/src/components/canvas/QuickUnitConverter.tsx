import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  convertUnits,
  DEFAULT_UNITS,
  formatConverted,
  getUnit,
  UNIT_CATEGORIES,
  type UnitCategory,
} from '../../lib/convert/unitEngine';

interface UnitFormState {
  category: UnitCategory;
  fromUnitId: string;
  toUnitId: string;
  fromValue: string;
}

const DEFAULTS: UnitFormState = {
  category: 'length',
  fromUnitId: DEFAULT_UNITS.length.from,
  toUnitId: DEFAULT_UNITS.length.to,
  fromValue: '1',
};

export default function QuickUnitConverter() {
  const initial = useMemo(
    () => loadPersistedJson<UnitFormState>(QUICK_TOOLS_STORAGE_KEYS.unitConverter, DEFAULTS),
    []
  );
  const [category, setCategory] = useState<UnitCategory>(initial.category);
  const [fromUnitId, setFromUnitId] = useState(initial.fromUnitId);
  const [toUnitId, setToUnitId] = useState(initial.toUnitId);
  const [fromValue, setFromValue] = useState(initial.fromValue);
  const [toValue, setToValue] = useState('');
  const [activeSide, setActiveSide] = useState<'from' | 'to'>('from');

  const units = UNIT_CATEGORIES[category];

  const syncFrom = useCallback(
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
    [units]
  );

  useEffect(() => {
    syncFrom('from', fromValue, toValue, fromUnitId, toUnitId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.unitConverter, {
      category,
      fromUnitId,
      toUnitId,
      fromValue,
    });
  }, [category, fromUnitId, toUnitId, fromValue]);

  const switchCategory = (next: UnitCategory) => {
    const defs = DEFAULT_UNITS[next];
    const unitList = UNIT_CATEGORIES[next];
    setCategory(next);
    setFromUnitId(defs.from);
    setToUnitId(defs.to);
    setFromValue('1');
    setActiveSide('from');
    syncFrom('from', '1', '', defs.from, defs.to, unitList);
  };

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 tabular-nums';

  const selectClass =
    'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  function pillClass(active: boolean): string {
    return `rounded-full border px-4 py-2 text-sm font-semibold capitalize transition ${
      active
        ? 'border-violet-500 bg-violet-600 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
    }`;
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Conversion category">
        {(['length', 'weight', 'temperature'] as UnitCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => switchCategory(cat)}
            className={pillClass(category === cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="min-w-0 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">From</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={fromValue}
            onChange={(e) => {
              setActiveSide('from');
              setFromValue(e.target.value);
              syncFrom('from', e.target.value, toValue, fromUnitId, toUnitId);
            }}
            className={inputClass}
          />
          <select
            value={fromUnitId}
            onChange={(e) => {
              setFromUnitId(e.target.value);
              syncFrom(activeSide, fromValue, toValue, e.target.value, toUnitId);
            }}
            className={selectClass}
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <div className="hidden pb-3 text-center text-xl text-violet-400 sm:block" aria-hidden="true">
          ⇄
        </div>

        <label className="min-w-0 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">To</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={toValue}
            onChange={(e) => {
              setActiveSide('to');
              setToValue(e.target.value);
              syncFrom('to', fromValue, e.target.value, fromUnitId, toUnitId);
            }}
            className={inputClass}
          />
          <select
            value={toUnitId}
            onChange={(e) => {
              setToUnitId(e.target.value);
              syncFrom(activeSide, fromValue, toValue, fromUnitId, e.target.value);
            }}
            className={selectClass}
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
