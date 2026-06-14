import { useCallback } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import {
  getMediaCanvasAction,
  type MediaCanvasAction,
} from '../../config/mediaCanvasActions';

interface UseMediaActionHandlerOptions {
  onFreeAction?: (action: MediaCanvasAction) => void;
  onProAction?: (action: MediaCanvasAction) => void;
}

export function useMediaActionHandler({
  onFreeAction,
  onProAction,
}: UseMediaActionHandlerOptions = {}) {
  const { data: session } = authClient.useSession();
  const userPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isPro = userPlan === 'pro';

  const handleActionClick = useCallback(
    (actionId: string) => {
      const action = getMediaCanvasAction(actionId);
      if (!action) return;

      if (action.tier === 'pro') {
        if (!isPro) {
          openProUpgrade({
            featureId: action.featureId ?? action.id,
            featureName: action.featureName ?? action.label,
            featureDescription:
              action.featureDescription ??
              'Unlock serverless AI image tools with GramSeva Mitra Pro.',
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
