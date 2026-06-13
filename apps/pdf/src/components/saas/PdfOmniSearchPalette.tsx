import OmniSearchPalette from '@shared/components/saas/OmniSearchPalette.tsx';
import type { OmniSearchTool } from '@shared/components/saas/omniSearch';
import { utilitiesHref, SITES } from '@shared/config/sites';
import { TOOLS_REGISTRY, type ToolId } from '../../config/toolsRegistry';

const STANDALONE_ROUTES: Partial<Record<ToolId, string>> = {
  'compress-kb': '/compress',
  'merge-pdf': '/merge',
  'split-pdf': '/split',
  'watermark-pdf': '/watermark',
  'protect-pdf': '/protect',
  'unlock-pdf': '/unlock',
  'pdf-scanner': '/scanner',
  'jpg-to-pdf': '/image-to-pdf',
};

function toolHref(id: ToolId): string {
  return STANDALONE_ROUTES[id] ?? `/studio#${id}`;
}

const pdfTools: OmniSearchTool[] = TOOLS_REGISTRY.map((tool) => ({
  id: tool.id,
  name: tool.name,
  description: tool.description,
  href: toolHref(tool.id),
  keywords: tool.keywords,
  aliases: tool.aliases,
}));

const crossAppTools: OmniSearchTool[] = [
  {
    id: 'utilities-hub',
    name: 'Utilities Super-App',
    description: 'Money, writing, career, wellness, and quick calculators — all offline.',
    href: utilitiesHref('/tools'),
    keywords: ['utilities', 'calculator', 'hub'],
  },
  {
    id: 'pdf-home',
    name: 'PDF Tools Home',
    description: 'Featured merge, compress, and convert PDF utilities.',
    href: `${SITES.pdf.url}/`,
    keywords: ['pdf home'],
  },
];

export default function PdfOmniSearchPalette() {
  return (
    <OmniSearchPalette
      tools={[...pdfTools, ...crossAppTools]}
      placeholder="Search PDF tools…"
      hint="Try merge, compress, split, watermark, or protect"
      footerLabel="PDF Quick Search"
    />
  );
}
