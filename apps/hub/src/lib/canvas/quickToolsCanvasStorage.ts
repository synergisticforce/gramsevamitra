/** Persistence helpers for Quick Tools workspace (Phase 8.1). */

import type { QuickToolId } from '../../config/quickToolsCanvasTools';

export const QUICK_TOOLS_STORAGE_KEYS = {
  activeTool: 'gsm-quick-tools-active',
  qrText: 'gsm-quick-tools-qr',
  password: 'gsm-quick-tools-password',
  unitConverter: 'gsm-quick-tools-unit',
} as const;

export function loadQuickActiveTool(): QuickToolId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUICK_TOOLS_STORAGE_KEYS.activeTool);
    if (
      raw === 'qr-generator' ||
      raw === 'password-generator' ||
      raw === 'unit-converter'
    ) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveQuickActiveTool(toolId: QuickToolId | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (toolId) {
      localStorage.setItem(QUICK_TOOLS_STORAGE_KEYS.activeTool, toolId);
    } else {
      localStorage.removeItem(QUICK_TOOLS_STORAGE_KEYS.activeTool);
    }
  } catch {
    /* ignore */
  }
}

export function loadPersistedJson<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function savePersistedJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
