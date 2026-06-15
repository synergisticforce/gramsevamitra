import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

export type WaterFrequency = 'daily' | 'every-other-day' | 'weekly';

export interface GardenPlant {
  id: string;
  name: string;
  sowDate: string;
  waterFrequency: WaterFrequency;
  notes: string;
  lastWatered: string | null;
}

function createPlantId(): string {
  return `plant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_PLANTS: GardenPlant[] = [
  {
    id: createPlantId(),
    name: 'Tomato',
    sowDate: new Date().toISOString().slice(0, 10),
    waterFrequency: 'daily',
    notes: 'Full sun, stake when tall',
    lastWatered: null,
  },
  {
    id: createPlantId(),
    name: 'Coriander',
    sowDate: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    waterFrequency: 'every-other-day',
    notes: 'Partial shade OK',
    lastWatered: null,
  },
  {
    id: createPlantId(),
    name: 'Chilli',
    sowDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    waterFrequency: 'weekly',
    notes: 'Harvest when red',
    lastWatered: null,
  },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const WATER_LABELS: Record<WaterFrequency, string> = {
  daily: 'Daily',
  'every-other-day': 'Every 2 days',
  weekly: 'Weekly',
};

export default function QuickGardenPlantingPlanner() {
  const initial = useMemo(
    () => loadPersistedJson<{ plants: GardenPlant[] }>(QUICK_TOOLS_STORAGE_KEYS.garden, { plants: DEFAULT_PLANTS }),
    []
  );
  const [plants, setPlants] = useState<GardenPlant[]>(initial.plants);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.garden, { plants });
  }, [plants]);

  const wateredToday = useMemo(() => plants.filter((p) => p.lastWatered === todayKey()).length, [plants]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const addPlant = () => {
    setPlants((prev) => [
      ...prev,
      {
        id: createPlantId(),
        name: 'New plant',
        sowDate: todayKey(),
        waterFrequency: 'daily',
        notes: '',
        lastWatered: null,
      },
    ]);
  };

  const updatePlant = (index: number, patch: Partial<GardenPlant>) => {
    setPlants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const markWatered = (index: number) => {
    updatePlant(index, { lastWatered: todayKey() });
  };

  const removePlant = (index: number) => {
    setPlants((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/80 p-4">
          <p className="text-xs font-semibold uppercase text-canvas-accent">Plants tracked</p>
          <p className="mt-1 text-2xl font-bold text-emerald-900">{plants.length}</p>
        </div>
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4">
          <p className="text-xs font-semibold uppercase text-canvas-subtle">Watered today</p>
          <p className="mt-1 text-2xl font-bold text-canvas-text">{wateredToday}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={addPlant} className="rounded-xl bg-canvas-accent-muted px-4 py-2 text-sm font-semibold text-canvas-text hover:bg-canvas-accent/40">
          + Add plant
        </button>
      </div>

      <ul className="space-y-3">
        {plants.map((plant, index) => (
          <li key={plant.id} className="rounded-xl border border-canvas-border bg-canvas-surface p-4 shadow-none">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input value={plant.name} onChange={(e) => updatePlant(index, { name: e.target.value })} placeholder="Plant name" className={inputClass} />
              <label className="text-xs font-medium leading-relaxed text-slate-300">
                Sown
                <input type="date" value={plant.sowDate} onChange={(e) => updatePlant(index, { sowDate: e.target.value })} className={`${inputClass} mt-1`} />
              </label>
              <select value={plant.waterFrequency} onChange={(e) => updatePlant(index, { waterFrequency: e.target.value as WaterFrequency })} className={inputClass}>
                {(Object.keys(WATER_LABELS) as WaterFrequency[]).map((key) => (
                  <option key={key} value={key}>
                    {WATER_LABELS[key]}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => markWatered(index)} className="flex-1 rounded-xl border border-emerald-300 bg-canvas-accent-soft px-2 py-2 text-xs font-semibold text-canvas-accent hover:bg-canvas-accent-soft">
                  💧 Watered
                </button>
                <button type="button" onClick={() => removePlant(index)} className="rounded-xl border border-canvas-border px-2 py-2 text-xs font-semibold text-rose-600">
                  Remove
                </button>
              </div>
            </div>
            <input value={plant.notes} onChange={(e) => updatePlant(index, { notes: e.target.value })} placeholder="Growing notes…" className={`${inputClass} mt-2`} />
            {plant.lastWatered && (
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-300">Last watered: {plant.lastWatered}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
