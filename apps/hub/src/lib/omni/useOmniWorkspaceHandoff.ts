import { useEffect, useState } from 'react';
import type { AppWorkspaceId } from '../../config/appWorkspaces';
import {
  clearOmniUrlParam,
  consumeOmniHandoff,
  readOmniIntentFromUrl,
  type OmniHandoffPayload,
} from './handoff';

export type OmniHandoffStatus = 'idle' | 'loading' | 'ready' | 'error';

interface UseOmniWorkspaceHandoffOptions {
  workspaceId: AppWorkspaceId;
  /** Gate until canvas session hydration completes. */
  enabled: boolean;
  onHandoff: (payload: OmniHandoffPayload) => void;
  onError?: (message: string) => void;
}

/**
 * Detects `?omni=` on mount, loads the File from IndexedDB, clears storage, and delegates to the canvas.
 */
export function useOmniWorkspaceHandoff({
  workspaceId,
  enabled,
  onHandoff,
  onError,
}: UseOmniWorkspaceHandoffOptions): OmniHandoffStatus {
  const [status, setStatus] = useState<OmniHandoffStatus>('idle');

  useEffect(() => {
    if (!enabled) return;

    const intentFromUrl = readOmniIntentFromUrl();
    if (!intentFromUrl) return;

    let cancelled = false;

    void (async () => {
      setStatus('loading');
      try {
        const payload = await consumeOmniHandoff(workspaceId);
        if (cancelled) return;

        if (!payload) {
          setStatus('error');
          clearOmniUrlParam();
          onError?.(
            'Could not load your file from the Omni-Router. Drop it again on the homepage and retry.',
          );
          return;
        }

        clearOmniUrlParam();
        onHandoff(payload);
        setStatus('ready');
      } catch {
        if (cancelled) return;
        setStatus('error');
        clearOmniUrlParam();
        onError?.('Omni-Router handoff failed. Please drop your file again on the homepage.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, workspaceId, onHandoff, onError]);

  return status;
}
