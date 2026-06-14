import { useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';
import {
  createJobId,
  emptyJobBoard,
  formatJobDate,
  JOB_TRACKER_COLUMNS,
  loadJobTrackerBoard,
  saveJobTrackerBoard,
  type JobApplicationEntry,
  type JobTrackerBoard,
  type JobTrackerColumnId,
} from '../../lib/canvas/careerJobTrackerStorage';

interface Props {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

interface FormState {
  company: string;
  role: string;
  notes: string;
  dateApplied: string;
}

const EMPTY_FORM: FormState = {
  company: '',
  role: '',
  notes: '',
  dateApplied: new Date().toISOString().slice(0, 10),
};

export default function JobTrackerModal({ onClose, onSuccess }: Props) {
  const [board, setBoard] = useState<JobTrackerBoard>(emptyJobBoard);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const boardRef = useRef<HTMLDivElement>(null);
  const sortablesRef = useRef<Sortable[]>([]);
  const boardStateRef = useRef(board);
  boardStateRef.current = board;

  useEffect(() => {
    setBoard(loadJobTrackerBoard());
  }, []);

  const persistBoard = useCallback((next: JobTrackerBoard) => {
    setBoard(next);
    saveJobTrackerBoard(next);
  }, []);

  const syncFromDom = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const next = emptyJobBoard();
    const prev = boardStateRef.current;
    const findCard = (id: string) => {
      for (const col of JOB_TRACKER_COLUMNS) {
        const found = prev[col.id].find((c) => c.id === id);
        if (found) return found;
      }
      return undefined;
    };
    for (const col of JOB_TRACKER_COLUMNS) {
      const list = el.querySelector(`[data-column-list="${col.id}"]`);
      if (!list) continue;
      list.querySelectorAll<HTMLElement>('[data-job-id]').forEach((cardEl) => {
        const id = cardEl.dataset.jobId;
        if (!id) return;
        const card = findCard(id);
        if (card) next[col.id].push(card);
      });
    }
    persistBoard(next);
  }, [persistBoard]);

  useEffect(() => {
    sortablesRef.current.forEach((s) => s.destroy());
    sortablesRef.current = [];
    const el = boardRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-column-list]').forEach((list) => {
      sortablesRef.current.push(
        Sortable.create(list, {
          group: 'career-job-tracker',
          animation: 180,
          delay: 100,
          delayOnTouchOnly: true,
          ghostClass: 'opacity-40',
          onEnd: syncFromDom,
        })
      );
    });
    return () => {
      sortablesRef.current.forEach((s) => s.destroy());
      sortablesRef.current = [];
    };
  }, [board, syncFromDom]);

  const totalJobs = JOB_TRACKER_COLUMNS.reduce((sum, col) => sum + board[col.id].length, 0);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, dateApplied: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  };

  const openEdit = (card: JobApplicationEntry) => {
    setEditingId(card.id);
    setForm({
      company: card.company,
      role: card.role,
      notes: card.notes,
      dateApplied: card.dateApplied || new Date().toISOString().slice(0, 10),
    });
    setFormOpen(true);
  };

  const deleteCard = (id: string) => {
    const next = emptyJobBoard();
    for (const col of JOB_TRACKER_COLUMNS) {
      next[col.id] = board[col.id].filter((c) => c.id !== id);
    }
    persistBoard(next);
    onSuccess('Application removed.');
  };

  const moveCard = (id: string, target: JobTrackerColumnId) => {
    let card: JobApplicationEntry | undefined;
    const next = emptyJobBoard();
    for (const col of JOB_TRACKER_COLUMNS) {
      next[col.id] = board[col.id].filter((c) => {
        if (c.id === id) {
          card = c;
          return false;
        }
        return true;
      });
    }
    if (!card) return;
    next[target] = [...next[target], card];
    persistBoard(next);
  };

  const submitForm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;

    const next = { ...board };
    if (editingId) {
      for (const col of JOB_TRACKER_COLUMNS) {
        next[col.id] = next[col.id].map((c) =>
          c.id === editingId
            ? {
                ...c,
                company: form.company.trim(),
                role: form.role.trim(),
                notes: form.notes.trim(),
                dateApplied: form.dateApplied,
              }
            : c
        );
      }
      persistBoard(next);
      onSuccess('Application updated.');
    } else {
      const card: JobApplicationEntry = {
        id: createJobId(),
        company: form.company.trim(),
        role: form.role.trim(),
        notes: form.notes.trim(),
        dateApplied: form.dateApplied,
      };
      next.wishlist = [...next.wishlist, card];
      persistBoard(next);
      onSuccess('Application added to Wishlist.');
    }
    setFormOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end justify-center bg-slate-900/50 p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-tracker-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !formOpen) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div>
            <h2 id="job-tracker-title" className="text-lg font-bold text-slate-900">
              📋 Job Application Tracker
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {totalJobs} application{totalJobs === 1 ? '' : 's'} · saved locally in your browser
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openAdd}
              className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
            >
              + Add job
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          ref={boardRef}
          className="flex flex-1 gap-3 overflow-x-auto p-4 snap-x snap-mandatory scroll-smooth sm:grid sm:grid-cols-5 sm:overflow-y-auto sm:snap-none"
        >
          {JOB_TRACKER_COLUMNS.map((col) => (
            <section
              key={col.id}
              className={`flex min-h-[320px] min-w-[78vw] snap-center flex-col rounded-xl border ${col.border} ${col.bg} sm:min-w-0`}
            >
              <header className="shrink-0 border-b border-slate-200/80 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-bold ${col.accent}`}>{col.label}</h3>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                    {board[col.id].length}
                  </span>
                </div>
              </header>
              <div
                className="column-list flex min-h-[100px] flex-1 flex-col gap-2 overflow-y-auto p-2"
                data-column-list={col.id}
              >
                {board[col.id].map((card) => (
                  <article
                    key={card.id}
                    data-job-id={card.id}
                    className="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openEdit(card)}
                      >
                        <h4 className="truncate text-sm font-bold text-slate-900">{card.company}</h4>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{card.role}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCard(card.id)}
                        className="shrink-0 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Delete ${card.company}`}
                      >
                        ✕
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                      {formatJobDate(card.dateApplied)}
                    </p>
                    {card.notes && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{card.notes}</p>
                    )}
                    <label className="mt-2 block sm:hidden">
                      <span className="sr-only">Move status</span>
                      <select
                        value={col.id}
                        onChange={(event) =>
                          moveCard(card.id, event.target.value as JobTrackerColumnId)
                        }
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
                      >
                        {JOB_TRACKER_COLUMNS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <form
            onSubmit={submitForm}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? 'Edit application' : 'Add job application'}
            </h3>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Company
                </span>
                <input
                  required
                  value={form.company}
                  onChange={(event) => setForm({ ...form, company: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </span>
                <input
                  required
                  value={form.role}
                  onChange={(event) => setForm({ ...form, role: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date applied
                </span>
                <input
                  type="date"
                  value={form.dateApplied}
                  onChange={(event) => setForm({ ...form, dateApplied: event.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes (optional)
                </span>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
