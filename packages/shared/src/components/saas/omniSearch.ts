export interface OmniSearchTool {
  id: string;
  name: string;
  description: string;
  href: string;
  keywords?: string[];
  aliases?: string[];
}

export function filterOmniSearchTools(tools: OmniSearchTool[], query: string): OmniSearchTool[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return tools.filter((tool) => {
    const matchName = tool.name.toLowerCase().includes(q);
    const matchDesc = tool.description.toLowerCase().includes(q);
    const matchKeywords = tool.keywords?.some((kw) => kw.toLowerCase().includes(q));
    const matchAlias = tool.aliases?.some((alias) => alias.toLowerCase().includes(q));
    return matchName || matchDesc || matchKeywords || matchAlias;
  });
}
