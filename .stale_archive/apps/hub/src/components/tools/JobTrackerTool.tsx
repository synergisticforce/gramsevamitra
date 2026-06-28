import { useCallback, useEffect, useRef, useState } from 'react';
import Sortable from 'sortablejs';

const STORAGE_KEY = 'gsm-tools:job-tracker-v2';

const COLUMNS = [
  { id: 'wishlist', label: 'Wishlist', accent: 'text-canvas-muted', border: 'border-canvas-border' },
  { id: 'applied', label: 'Applied', accent: 'text-sky-400', border: 'border-sky-800/50' },
  { id: 'interviewing', label: 'Interviewing', accent: 'text-amber-400', border: 'border-amber-800/50' },
  { id: 'offer', label: 'Offer', accent: 'text-canvas-accent', border: 'border-canvas-border' },
  { id: 'rejected', label: 'Rejected', accent: 'text-rose-400', border: 'border-rose-800/50' },
] as const;

type ColumnId = (typeof COLUMNS)[number]['id'];

export interface JobCard {
  id: string;
  company: string;
  role: string;
  salary: string;
  dateApplied: string;
  link: string;
  jobDescription: string;
  notes: string;
  checklist: { id: string; text: string; done: boolean }[];
}

type BoardState = Record<ColumnId, JobCard[]>;

function emptyBoard(): BoardState {
  return { wishlist: [], applied: [], interviewing: [], offer: [], rejected: [] };
}

function createId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(iso: string): string {
  if (!iso) return 'No date';
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function JobTrackerTool() {
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    company: '',
    role: '',
    salary: '',
    dateApplied: new Date().toISOString().slice(0, 10),
    link: '',
    jobDescription: '',
    notes: '',
    checklistText: '',
  });
  const boardRef = useRef<HTMLDivElement>(null);
  const sortablesRef = useRef<Sortable[]>([]);
  const boardStateRef = useRef(board);
  boardStateRef.current = board;

  const loadBoard = useCallback((): BoardState => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyBoard();
      const parsed = JSON.parse(raw) as Partial<BoardState>;
      const next = emptyBoard();
      for (const col of COLUMNS) {
        const items = parsed[col.id];
        if (!Array.isArray(items)) continue;
        next[col.id] = items.filter((item) => item && typeof item.id === 'string').map((item) => ({
          id: item.id,
          company: String(item.company ?? ''),
          role: String(item.role ?? ''),
          salary: String(item.salary ?? ''),
          dateApplied: String(item.dateApplied ?? ''),
          link: String(item.link ?? ''),
          jobDescription: String(item.jobDescription ?? ''),
          notes: String(item.notes ?? ''),
          checklist: Array.isArray(item.checklist)
            ? item.checklist.map((c) => ({
                id: String(c.id ?? createId()),
                text: String(c.text ?? ''),
                done: Boolean(c.done),
              }))
            : [],
        }));
      }
      return next;
    } catch {
      return emptyBoard();
    }
  }, []);

  const saveBoard = useCallback((next: BoardState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setBoard(loadBoard());
  }, [loadBoard]);

  const syncFromDom = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const next = emptyBoard();
    const prev = boardStateRef.current;
    const findCard = (id: string) => {
      for (const col of COLUMNS) {
        const found = prev[col.id].find((c) => c.id === id);
        if (found) return found;
      }
      return undefined;
    };
    for (const col of COLUMNS) {
      const list = el.querySelector(`[data-column-list="${col.id}"]`);
      if (!list) continue;
      list.querySelectorAll<HTMLElement>('[data-job-id]').forEach((cardEl) => {
        const id = cardEl.dataset.jobId;
        if (!id) return;
        const card = findCard(id);
        if (card) next[col.id].push(card);
      });
    }
    setBoard(next);
    saveBoard(next);
  }, [saveBoard]);

  useEffect(() => {
    sortablesRef.current.forEach((s) => s.destroy());
    sortablesRef.current = [];
    const el = boardRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>('[data-column-list]').forEach((list) => {
      sortablesRef.current.push(
        Sortable.create(list, {
          group: 'job-tracker',
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

  const totalJobs = COLUMNS.reduce((sum, col) => sum + board[col.id].length, 0);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      company: '',
      role: '',
      salary: '',
      dateApplied: new Date().toISOString().slice(0, 10),
      link: '',
      jobDescription: '',
      notes: '',
      checklistText: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (card: JobCard) => {
    setEditingId(card.id);
    setForm({
      company: card.company,
      role: card.role,
      salary: card.salary,
      dateApplied: card.dateApplied,
      link: card.link,
      jobDescription: card.jobDescription,
      notes: card.notes,
      checklistText: card.checklist.map((c) => c.text).join('\n'),
    });
    setModalOpen(true);
  };

  const deleteCard = (id: string) => {
    const next = emptyBoard();
    for (const col of COLUMNS) {
      next[col.id] = board[col.id].filter((c) => c.id !== id);
    }
    setBoard(next);
    saveBoard(next);
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.role.trim()) return;

    const checklist = form.checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ id: createId(), text, done: false }));

    const next = { ...board };
    if (editingId) {
      for (const col of COLUMNS) {
        next[col.id] = next[col.id].map((c) =>
          c.id === editingId
            ? {
                ...c,
                company: form.company.trim(),
                role: form.role.trim(),
                salary: form.salary.trim(),
                dateApplied: form.dateApplied,
                link: form.link.trim(),
                jobDescription: form.jobDescription.trim(),
                notes: form.notes.trim(),
                checklist: checklist.length > 0 ? checklist : c.checklist,
              }
            : c
        );
      }
    } else {
      const card: JobCard = {
        id: createId(),
        company: form.company.trim(),
        role: form.role.trim(),
        salary: form.salary.trim(),
        dateApplied: form.dateApplied,
        link: form.link.trim(),
        jobDescription: form.jobDescription.trim(),
        notes: form.notes.trim(),
        checklist,
      };
      next.wishlist = [...next.wishlist, card];
    }
    setBoard(next);
    saveBoard(next);
    setModalOpen(false);
  };

  const toggleChecklistItem = (cardId: string, itemId: string) => {
    const next = { ...board };
    for (const col of COLUMNS) {
      next[col.id] = next[col.id].map((c) =>
        c.id === cardId
          ? {
              ...c,
              checklist: c.checklist.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item
              ),
            }
          : c
      );
    }
    setBoard(next);
    saveBoard(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium leading-relaxed text-slate-300">{totalJobs} application{totalJobs === 1 ? '' : 's'} tracked · saved locally</p>
        <button type="button" onClick={openAddModal} className="btn-primary px-4 py-2 text-sm">+ Add job</button>
      </div>

      <div
        ref={boardRef}
        className="-mx-1 flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory scroll-smooth px-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:gap-3 sm:overflow-visible"
        role="region"
        aria-label="Job application Kanban board"
      >
        {COLUMNS.map((col) => (
          <section
            key={col.id}
            className={`flex min-h-[420px] min-w-[85vw] snap-center flex-col rounded-2xl border bg-canvas-accent-muted/50 sm:min-w-0 ${col.border}`}
            data-column={col.id}
          >
            <header className="shrink-0 border-b border-slate-800 px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className={`text-sm font-bold ${col.accent}`}>{col.label}</h2>
                <span className="rounded-full bg-canvas-elevated px-2 py-0.5 text-[10px] font-bold tabular-nums text-canvas-subtle">
                  {board[col.id].length}
                </span>
              </div>
            </header>
            <div className="column-list flex min-h-[120px] flex-1 flex-col gap-2 overflow-y-auto p-2" data-column-list={col.id}>
              {board[col.id].map((card) => (
                <article
                  key={card.id}
                  data-job-id={card.id}
                  className="cursor-grab rounded-xl border border-canvas-border bg-slate-950/80 p-3 shadow-none active:cursor-grabbing"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditModal(card)}>
                      <h3 className="truncate text-sm font-bold text-canvas-text">{card.company}</h3>
                      <p className="mt-0.5 truncate text-xs font-medium leading-relaxed text-slate-300">{card.role}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCard(card.id)}
                      className="shrink-0 rounded-lg p-1 text-canvas-subtle hover:bg-rose-950/50 hover:text-rose-400"
                      aria-label={`Delete ${card.company}`}
                    >
                      ✕
                    </button>
                  </div>
                  {card.salary && (
                    <p className="mt-2 text-xs font-medium text-canvas-accent">{card.salary}</p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-canvas-subtle">{formatDate(card.dateApplied)}</p>
                  {card.link && (
                    <a
                      href={card.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex text-xs font-semibold text-canvas-accent hover:text-canvas-accent"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View posting ↗
                    </a>
                  )}
                  {card.checklist.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-slate-800 pt-2">
                      {card.checklist.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          <label className="flex items-center gap-2 text-[10px] text-canvas-subtle">
                            <input
                              type="checkbox"
                              checked={item.done}
                              onChange={() => toggleChecklistItem(card.id, item.id)}
                              className="h-3 w-3 accent-emerald-500"
                            />
                            <span className={item.done ? 'line-through opacity-60' : ''}>{item.text}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog">
          <form
            onSubmit={submitForm}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-canvas-border bg-canvas-accent-muted p-5 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-canvas-text">{editingId ? 'Edit application' : 'Add job application'}</h2>
            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="label">Company</span>
                <input required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field w-full" />
              </label>
              <label className="block">
                <span className="label">Role</span>
                <input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input-field w-full" />
              </label>
              <label className="block">
                <span className="label">Salary / CTC (optional)</span>
                <input value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="e.g. ₹12 LPA" className="input-field w-full" />
              </label>
              <label className="block">
                <span className="label">Date applied</span>
                <input type="date" value={form.dateApplied} onChange={(e) => setForm({ ...form, dateApplied: e.target.value })} className="input-field w-full" />
              </label>
              <label className="block">
                <span className="label">Job link</span>
                <input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} className="input-field w-full" />
              </label>
              <label className="block">
                <span className="label">Job description</span>
                <textarea rows={3} value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} className="input-field w-full resize-y text-sm" />
              </label>
              <label className="block">
                <span className="label">Notes</span>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-field w-full resize-y text-sm" />
              </label>
              <label className="block">
                <span className="label">Checklist (one item per line)</span>
                <textarea rows={3} value={form.checklistText} onChange={(e) => setForm({ ...form, checklistText: e.target.value })} placeholder="Tailor resume&#10;Research company&#10;Follow up in 1 week" className="input-field w-full resize-y text-sm" />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button type="submit" className="btn-primary flex-1 text-sm">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
