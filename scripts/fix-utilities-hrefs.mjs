#!/usr/bin/env node
/**
 * Rewrites relative /tools hrefs to utilitiesHref() in hub tool pages and components.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = [
  path.join(ROOT, 'apps/hub/src/pages/tools'),
  path.join(ROOT, 'apps/hub/src/components/tools'),
];

const IMPORT_LINE = "import { utilitiesHref } from '@shared/config/sites';";
const SITES_IMPORT = "import { SITES, utilitiesHref } from '@shared/config/sites';";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith('.astro')) files.push(full);
  }
  return files;
}

function ensureImport(content) {
  if (content.includes('utilitiesHref')) return content;

  if (content.includes("import { SITES } from '@shared/config/sites';")) {
    return content.replace(
      "import { SITES } from '@shared/config/sites';",
      SITES_IMPORT
    );
  }

  if (content.includes("import { formatSeoTitle } from '@shared/config/seo';")) {
    return content.replace(
      "import { formatSeoTitle } from '@shared/config/seo';",
      `import { formatSeoTitle } from '@shared/config/seo';\n${IMPORT_LINE}`
    );
  }

  if (content.includes("import ToolsLayout")) {
    return content.replace(
      /(import ToolsLayout[^\n]+\n)/,
      `$1${IMPORT_LINE}\n`
    );
  }

  if (content.includes("import type { ToolEntry }")) {
    return content.replace(
      /(import type \{ ToolEntry \}[^\n]+\n)/,
      `$1${IMPORT_LINE}\n`
    );
  }

  if (content.includes("import type { WorkspaceMeta }")) {
    return content.replace(
      /(import type \{ WorkspaceMeta \}[^\n]+\n)/,
      `$1${IMPORT_LINE}\n`
    );
  }

  return `---\n${IMPORT_LINE}\n---\n${content}`;
}

function patchFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  if (!content.includes('href="/tools')) return false;

  content = ensureImport(content);
  content = content.replace(/href="(\/tools[^"]*)"/g, (_, route) => {
    return `href={utilitiesHref('${route}')}`;
  });

  writeFileSync(filePath, content);
  return true;
}

let patched = 0;
for (const dir of TARGETS) {
  for (const file of walk(dir)) {
    if (patchFile(file)) {
      patched += 1;
      console.log(`✓ ${path.relative(ROOT, file)}`);
    }
  }
}

console.log(`\nPatched ${patched} file(s).`);
