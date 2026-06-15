import { useCallback } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import {
  getCareerCanvasAction,
  type CareerCanvasAction,
} from '../../config/careerCanvasActions';

interface UseCareerActionHandlerOptions {
  onFreeAction?: (action: CareerCanvasAction) => void;
  onProAction?: (action: CareerCanvasAction) => void;
}

export function useCareerActionHandler({
  onFreeAction,
  onProAction,
}: UseCareerActionHandlerOptions = {}) {
  const { data: session } = authClient.useSession();
  const userPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isPro = userPlan === 'pro';

  const handleActionClick = useCallback(
    (actionId: string) => {
      const action = getCareerCanvasAction(actionId);
      if (!action) return;

      if (action.tier === 'pro') {
        if (!isPro) {
          openProUpgrade({
            featureId: action.featureId ?? action.id,
            featureName: action.featureName ?? action.label,
            featureDescription:
              action.featureDescription ??
              'Unlock advanced AI career tools with GramSeva Mitra Pro.',
          });
          return;
        }
        onProAction?.(action);
        return;
      }

      onFreeAction?.(action);
    },
    [isPro, onFreeAction, onProAction],
  );

  return { handleActionClick, isPro, userPlan };
}
