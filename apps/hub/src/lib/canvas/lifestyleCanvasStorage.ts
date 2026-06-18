/** localStorage persistence for Health & Lifestyle workspace (Phase 4). */

import type { LifestyleToolId } from '../../config/lifestyleCanvasTools';
import { isLifestyleToolId } from '../../config/lifestyleCanvasTools';

export const LIFESTYLE_STORAGE_KEYS = {
  bmi: 'gsm-lifestyle-bmi',
  bodyFat: 'gsm-lifestyle-body-fat',
  macro: 'gsm-lifestyle-macro',
  ageDate: 'gsm-lifestyle-age-date',
  examAge: 'gsm-lifestyle-exam-age',
  menstrual: 'gsm-lifestyle-menstrual',
  moodLog: 'gsm-lifestyle-mood-log',
  activeTool: 'gsm-lifestyle-active',
} as const;

export function loadPersistedJson<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function savePersistedJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export function loadLifestyleActiveTool(): LifestyleToolId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LIFESTYLE_STORAGE_KEYS.activeTool);
    if (raw && isLifestyleToolId(raw)) return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveLifestyleActiveTool(toolId: LifestyleToolId | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (toolId) {
      localStorage.setItem(LIFESTYLE_STORAGE_KEYS.activeTool, toolId);
    } else {
      localStorage.removeItem(LIFESTYLE_STORAGE_KEYS.activeTool);
    }
  } catch {
    /* ignore */
  }
}
