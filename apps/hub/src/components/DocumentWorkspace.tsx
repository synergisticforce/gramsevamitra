import DocumentStudioCanvas from './canvas/DocumentStudioCanvas';
import ScanHomeScreen from '../mobile/views/ScanHomeScreen';
import { usePlatform } from '../shared/hooks/usePlatform';

/**
 * Documents workspace entry:
 * - Phones / Capacitor → offline scan-and-save home
 * - Desktop browsers → full Document Studio canvas
 */
export default function DocumentWorkspace() {
  const { isDesktop } = usePlatform();

  if (isDesktop) {
    return <DocumentStudioCanvas />;
  }

  return <ScanHomeScreen />;
}
