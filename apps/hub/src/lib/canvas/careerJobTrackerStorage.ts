/** Offline job application tracker — localStorage persistence for Career Prep canvas. */

export const CAREER_JOB_TRACKER_KEY = 'gsm-canvas-career:job-tracker';

export const JOB_TRACKER_COLUMNS = [
  { id: 'wishlist', label: 'Wishlist', accent: 'text-canvas-muted', border: 'border-canvas-border', bg: 'bg-canvas-elevated' },
  { id: 'applied', label: 'Applied', accent: 'text-sky-700', border: 'border-canvas-border', bg: 'bg-canvas-elevated' },
  { id: 'interviewing', label: 'Interviewing', accent: 'text-canvas-muted', border: 'border-canvas-border', bg: 'bg-canvas-elevated' },
  { id: 'offer', label: 'Offer', accent: 'text-canvas-accent', border: 'border-canvas-border', bg: 'bg-canvas-accent-soft' },
  { id: 'rejected', label: 'Rejected', accent: 'text-rose-700', border: 'border-canvas-border', bg: 'bg-canvas-danger-soft/30' },
] as const;

export type JobTrackerColumnId = (typeof JOB_TRACKER_COLUMNS)[number]['id'];

export interface JobApplicationEntry {
  id: string;
  company: string;
  role: string;
  notes: string;
  dateApplied: string;
}

export type JobTrackerBoard = Record<JobTrackerColumnId, JobApplicationEntry[]>;

export function createJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyJobBoard(): JobTrackerBoard {
  return { wishlist: [], applied: [], interviewing: [], offer: [], rejected: [] };
}

export function loadJobTrackerBoard(): JobTrackerBoard {
  if (typeof window === 'undefined') return emptyJobBoard();
  try {
    const raw = localStorage.getItem(CAREER_JOB_TRACKER_KEY);
    if (!raw) return emptyJobBoard();
    const parsed = JSON.parse(raw) as Partial<JobTrackerBoard>;
    const next = emptyJobBoard();
    for (const col of JOB_TRACKER_COLUMNS) {
      const items = parsed[col.id];
      if (!Array.isArray(items)) continue;
      next[col.id] = items
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({
          id: String(item.id),
          company: String(item.company ?? ''),
          role: String(item.role ?? ''),
          notes: String(item.notes ?? ''),
          dateApplied: String(item.dateApplied ?? ''),
        }));
    }
    return next;
  } catch {
    return emptyJobBoard();
  }
}

export function saveJobTrackerBoard(board: JobTrackerBoard): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAREER_JOB_TRACKER_KEY, JSON.stringify(board));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function formatJobDate(iso: string): string {
  if (!iso) return 'No date';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
