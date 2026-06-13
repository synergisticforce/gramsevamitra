import OmniSearchPalette from '@shared/components/saas/OmniSearchPalette.tsx';
import type { OmniSearchTool } from '@shared/components/saas/omniSearch';
import { SITES, utilitiesHref } from '@shared/config/sites';
import { TOOLS_REGISTRY } from '../../config/toolsRegistry';

const hubTools: OmniSearchTool[] = TOOLS_REGISTRY.map((tool) => ({
  id: tool.id,
  name: tool.name,
  description: tool.description,
  href: utilitiesHref(tool.path),
  keywords: tool.keywords,
  aliases: tool.aliases,
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

const ALL_TOOLS = [...hubTools, ...crossAppTools];

export default function HubOmniSearchPalette() {
  return (
    <OmniSearchPalette
      tools={ALL_TOOLS}
      placeholder="Search 83+ free tools…"
      hint="Try EMI calculator, QR code, baby names, or PDF tools"
      footerLabel="Quick Tools Drawer"
    />
  );
}
