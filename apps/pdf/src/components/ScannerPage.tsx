import { ToolProgressProvider } from './workspaces/ToolProgressContext';
import PdfScannerEffectTool from './workspaces/PdfScannerEffectTool';

export default function ScannerPage() {
  return (
    <ToolProgressProvider>
      <PdfScannerEffectTool />
    </ToolProgressProvider>
  );
}
