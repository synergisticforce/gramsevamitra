import { useCallback, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';

export interface GatekeeperResult {
  isPro: boolean;
  checkAccess: (onAllow: () => void) => void;
}

export interface FeatureGateState extends GatekeeperResult {
  /** When true, render `UpgradeScreen` instead of the gated tool UI. */
  showUpgrade: boolean;
  dismissUpgrade: () => void;
}

/**
 * Reads the signed-in user's plan and gates Pro-only actions.
 * Free users are sent to UpgradeScreen via `showUpgrade`.
 */
export function useFeatureGate(): FeatureGateState {
  const { data: session } = authClient.useSession();
  const userPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isPro = userPlan === 'pro';
  const [showUpgrade, setShowUpgrade] = useState(false);

  const checkAccess = useCallback(
    (onAllow: () => void) => {
      if (isPro) {
        onAllow();
        return;
      }
      setShowUpgrade(true);
    },
    [isPro],
  );

  const dismissUpgrade = useCallback(() => {
    setShowUpgrade(false);
  }, []);

  return {
    isPro,
    checkAccess,
    showUpgrade,
    dismissUpgrade,
  };
}
