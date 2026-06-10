import { ToolProgressProvider } from './workspaces/ToolProgressContext';
import CompressKbTool from './workspaces/CompressKbTool';

export default function CompressPage() {
  return (
    <ToolProgressProvider>
      <CompressKbTool />
    </ToolProgressProvider>
  );
}
