import { useEffect } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { DEFAULT_APP_WORKSPACE } from '../../config/appWorkspaces';

/** Send signed-in users to the default workspace canvas. */
export default function AppAuthRedirect() {
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || !session?.user) return;
    window.location.replace(DEFAULT_APP_WORKSPACE.href);
  }, [session, isPending]);

  return null;
}
