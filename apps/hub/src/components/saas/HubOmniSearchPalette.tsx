import OmniSearchPalette from '@shared/components/saas/OmniSearchPalette.tsx';
import type { OmniSearchTool } from '@shared/components/saas/omniSearch';
import { SITES } from '@shared/config/sites';
import { APP_WORKSPACES } from '../../config/appWorkspaces';

const workspaceTools: OmniSearchTool[] = APP_WORKSPACES.map((workspace) => ({
  id: workspace.id,
  name: workspace.label,
  description: workspace.description,
  href: workspace.href,
  keywords: [workspace.id, workspace.label.toLowerCase(), 'workspace'],
  aliases: [workspace.label],
}));

const crossAppTools: OmniSearchTool[] = [
  {
    id: 'pdf-studio',
    name: 'PDF Tools Studio',
    description: 'Merge, compress, split, sign, and convert PDFs — 100% in your browser.',
    href: `${SITES.pdf.url}/studio`,
    keywords: ['pdf', 'merge', 'compress', 'split'],
    aliases: ['pdf tools'],
  },
];

const ALL_TOOLS = [...workspaceTools, ...crossAppTools];

export default function HubOmniSearchPalette() {
  return (
    <OmniSearchPalette
      tools={ALL_TOOLS}
      placeholder="Search workspaces and tools…"
      hint="Try Document Studio, Finance Hub, or PDF Tools"
      footerLabel="App Workspaces"
    />
  );
}
