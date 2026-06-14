export const PRO_UPGRADE_OPEN_EVENT = 'gsm-pro-upgrade-open';

export interface ProUpgradeDetail {
  featureId?: string;
  featureName: string;
  featureDescription?: string;
}

/** Pro plan billing — see packages/shared/src/lib/proBilling.mjs for canonical amounts. */
export {
  PRO_ORDER_AMOUNT_PAISE,
  PRO_ORDER_CURRENCY,
  PRO_PRICE_INTERVAL,
  PRO_PRICE_LABEL,
} from './proBilling.mjs';

export function openProUpgrade(detail: ProUpgradeDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProUpgradeDetail>(PRO_UPGRADE_OPEN_EVENT, { detail }));
}
