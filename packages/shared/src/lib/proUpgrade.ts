export const PRO_UPGRADE_OPEN_EVENT = 'gsm-pro-upgrade-open';

export interface ProUpgradeDetail {
  featureId?: string;
  featureName: string;
  featureDescription?: string;
}

export const PRO_PRICE_LABEL = '₹199';
export const PRO_PRICE_INTERVAL = '/month';

export function openProUpgrade(detail: ProUpgradeDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProUpgradeDetail>(PRO_UPGRADE_OPEN_EVENT, { detail }));
}
