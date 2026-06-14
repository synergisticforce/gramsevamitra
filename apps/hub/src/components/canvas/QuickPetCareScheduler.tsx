import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';

export type PetTaskFrequency = 'daily' | 'weekly';

export interface PetCareTask {
  id: string;
  title: string;
  frequency: PetTaskFrequency;
  time: string;
  notes: string;
  lastDone: string | null;
}

function createTaskId(): string {
  return `pet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_TASKS: PetCareTask[] = [
  { id: createTaskId(), title: 'Morning feed', frequency: 'daily', time: '07:00', notes: '1 cup dry food', lastDone: null },
  { id: createTaskId(), title: 'Evening walk', frequency: 'daily', time: '18:30', notes: '20 min', lastDone: null },
  { id: createTaskId(), title: 'Grooming / bath', frequency: 'weekly', time: '10:00', notes: 'Sundays', lastDone: null },
  { id: createTaskId(), title: 'Vet check reminder', frequency: 'weekly', time: '09:00', notes: 'Weigh & inspect', lastDone: null },
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function QuickPetCareScheduler() {
  const initial = useMemo(
    () => loadPersistedJson<{ tasks: PetCareTask[] }>(QUICK_TOOLS_STORAGE_KEYS.petCare, { tasks: DEFAULT_TASKS }),
    []
  );
  const [tasks, setTasks] = useState<PetCareTask[]>(initial.tasks);
  const [filter, setFilter] = useState<'all' | PetTaskFrequency>('all');

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.petCare, { tasks });
  }, [tasks]);

  const visible = useMemo(
    () => (filter === 'all' ? tasks : tasks.filter((t) => t.frequency === filter)),
    [tasks, filter]
  );

  const doneToday = useMemo(
    () => tasks.filter((t) => t.lastDone === todayKey()).length,
    [tasks]
  );

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      { id: createTaskId(), title: 'New task', frequency: 'daily', time: '08:00', notes: '', lastDone: null },
    ]);
  };

  const updateTask = (id: string, patch: Partial<PetCareTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const toggleDone = (id: string) => {
    const today = todayKey();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, lastDone: t.lastDone === today ? null : today } : t))
    );
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
          <p className="text-xs font-semibold uppercase text-violet-700">Tasks</p>
          <p className="mt-1 text-2xl font-bold text-violet-900">{tasks.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Done today</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{doneToday}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Daily / Weekly</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {tasks.filter((t) => t.frequency === 'daily').length} / {tasks.filter((t) => t.frequency === 'weekly').length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'daily', 'weekly'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${
              filter === f ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
        <button type="button" onClick={addTask} className="ml-auto rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700">
          + Add task
        </button>
      </div>

      <ul className="space-y-3">
        {visible.map((task) => {
          const isDone = task.lastDone === todayKey();
          return (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleDone(task.id)}
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-transparent'
                  }`}
                  aria-label={isDone ? 'Mark incomplete' : 'Mark done today'}
                >
                  ✓
                </button>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input value={task.title} onChange={(e) => updateTask(task.id, { title: e.target.value })} className={inputClass} />
                    <select value={task.frequency} onChange={(e) => updateTask(task.id, { frequency: e.target.value as PetTaskFrequency })} className={inputClass}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    <input type="time" value={task.time} onChange={(e) => updateTask(task.id, { time: e.target.value })} className={inputClass} />
                  </div>
                  <input value={task.notes} onChange={(e) => updateTask(task.id, { notes: e.target.value })} placeholder="Notes (portions, duration…)" className={inputClass} />
                  {isDone && <p className="text-xs text-emerald-600">Completed today</p>}
                </div>
                <button type="button" onClick={() => removeTask(task.id)} className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
