/** localStorage persistence for Finance Hub calculators (Phase 7.1). */

import type { FinanceToolId } from '../../config/financeCanvasTools';
import { isFinanceToolId } from '../../config/financeCanvasTools';

export const FINANCE_STORAGE_KEYS = {
  sip: 'gsm-finance-sip',
  emi: 'gsm-finance-emi',
  gst: 'gsm-finance-gst',
  discount: 'gsm-finance-discount',
  loan: 'gsm-finance-loan',
  tip: 'gsm-finance-tip',
  meeting: 'gsm-finance-meeting',
  tax: 'gsm-finance-tax',
  currency: 'gsm-finance-currency',
  invoice: 'gsm-finance-invoice',
  paystub: 'gsm-finance-paystub',
  crypto: 'gsm-finance-crypto',
  envelope: 'gsm-finance-envelope',
  gig: 'gsm-finance-gig',
  activeTool: 'gsm-finance-active',
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

export function loadFinanceActiveTool(): FinanceToolId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEYS.activeTool);
    if (raw && isFinanceToolId(raw)) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFinanceActiveTool(toolId: FinanceToolId | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (toolId) {
      localStorage.setItem(FINANCE_STORAGE_KEYS.activeTool, toolId);
    } else {
      localStorage.removeItem(FINANCE_STORAGE_KEYS.activeTool);
    }
  } catch {
    /* ignore */
  }
}
