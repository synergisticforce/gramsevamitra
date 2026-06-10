export type VisualGridMode = 'view' | 'rotate' | 'reorder' | 'remove' | 'group-select' | 'organize';

export type PageRotation = 0 | 90 | 180 | 270;

export interface PageVisualState {
  pageNum: number;
  rotation: PageRotation;
  removed: boolean;
  groupId: string | null;
}

export interface PageGroup {
  id: string;
  label: string;
  borderClass: string;
  badgeClass: string;
}

export const DEFAULT_SPLIT_GROUPS: PageGroup[] = [
  {
    id: 'group-1',
    label: 'Group 1',
    borderClass: 'border-sky-500',
    badgeClass: 'bg-sky-500/20 text-sky-300',
  },
  {
    id: 'group-2',
    label: 'Group 2',
    borderClass: 'border-amber-500',
    badgeClass: 'bg-amber-500/20 text-amber-300',
  },
];

export function createInitialPageStates(pageCount: number): PageVisualState[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    pageNum: i + 1,
    rotation: 0,
    removed: false,
    groupId: null,
  }));
}

export function cycleRotation(current: PageRotation): PageRotation {
  if (current === 0) return 90;
  if (current === 90) return 180;
  if (current === 180) return 270;
  return 0;
}

export const EXTRA_GROUP_STYLES = [
  { borderClass: 'border-violet-500', badgeClass: 'bg-violet-500/20 text-violet-300' },
  { borderClass: 'border-rose-500', badgeClass: 'bg-rose-500/20 text-rose-300' },
  { borderClass: 'border-lime-500', badgeClass: 'bg-lime-500/20 text-lime-300' },
  { borderClass: 'border-cyan-500', badgeClass: 'bg-cyan-500/20 text-cyan-300' },
];
