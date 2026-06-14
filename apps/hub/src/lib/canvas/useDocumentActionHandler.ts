import { useCallback } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import {
  getDocumentCanvasAction,
  type DocumentCanvasAction,
} from '../../config/documentCanvasActions';

interface UseDocumentActionHandlerOptions {
  onFreeAction?: (action: DocumentCanvasAction) => void;
  onProAction?: (action: DocumentCanvasAction) => void;
}

export function useDocumentActionHandler({
  onFreeAction,
  onProAction,
}: UseDocumentActionHandlerOptions = {}) {
  const { data: session } = authClient.useSession();
  const userPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isPro = userPlan === 'pro';

  const handleActionClick = useCallback(
    (actionId: string) => {
      const action = getDocumentCanvasAction(actionId);
      if (!action) return;

      if (action.tier === 'pro') {
        if (!isPro) {
          openProUpgrade({
            featureId: action.featureId ?? action.id,
            featureName: action.featureName ?? action.label,
            featureDescription:
              action.featureDescription ??
              'Unlock serverless AI document tools with GramSeva Mitra Pro.',
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
