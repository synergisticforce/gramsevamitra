import { Suspense, lazy } from 'react';
import ScanHomeScreen from '../mobile/views/ScanHomeScreen';
import { usePlatform } from '../shared/hooks/usePlatform';

/**
 * The desktop canvas is a large bundle, so it is loaded on demand. Phones and
 * the Capacitor shell must never download it just to reach the scan home.
 */
const DocumentStudioCanvas = lazy(() => import('./canvas/DocumentStudioCanvas'));

function WorkspaceFallback() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-canvas-border border-t-canvas-accent"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-canvas-text">Opening your workspace…</p>
      </div>
    </div>
  );
}

/**
 * Documents workspace entry:
 * - Phones / Capacitor → offline scan-and-save home
 * - Desktop browsers → full Document Studio canvas
 */
export default function DocumentWorkspace() {
  const { isDesktop, resolved } = usePlatform();

  if (!resolved) {
    return <WorkspaceFallback />;
  }

  if (isDesktop) {
    return (
      <Suspense fallback={<WorkspaceFallback />}>
        <DocumentStudioCanvas />
      </Suspense>
    );
  }

  return <ScanHomeScreen />;
}
