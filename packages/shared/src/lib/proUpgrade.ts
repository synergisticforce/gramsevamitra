export const PRO_UPGRADE_OPEN_EVENT = 'gsm-pro-upgrade-open';

export interface ProUpgradeDetail {
  featureId?: string;
  featureName: string;
  featureDescription?: string;
}

/** Pro annual plan — keep in sync with packages/shared/src/lib/proBilling.mjs */
export const PRO_ORDER_AMOUNT_PAISE = 9900;
export const PRO_ORDER_CURRENCY = 'INR';
export const PRO_PRICE_LABEL = '₹99';
export const PRO_PRICE_INTERVAL = '/year';

export function openProUpgrade(detail: ProUpgradeDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProUpgradeDetail>(PRO_UPGRADE_OPEN_EVENT, { detail }));
}
