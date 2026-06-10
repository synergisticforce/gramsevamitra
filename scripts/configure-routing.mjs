#!/usr/bin/env node
/**
 * Final routing phase: Pages custom domains + DNS CNAMEs + preview robots + cache purge.
 *
 * Usage: node scripts/configure-routing.mjs
 * Requires: authenticated wrangler OAuth session or CLOUDFLARE_API_TOKEN with
 *   Pages:Edit, Zone:Read, DNS:Edit, Cache Purge permissions.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'b440186dd17095f27299d6fb3bfcc663';
const ZONE_NAME = 'gramsevamitra.com';

const PROJECTS = [
  {
    project: 'gramsevamitra-hub',
    domains: ['gramsevamitra.com', 'www.gramsevamitra.com'],
    cnameTarget: 'gramsevamitra-hub.pages.dev',
    dnsHosts: ['@', 'www'],
  },
  {
    project: 'gramsevamitra-optimizer',
    domains: ['optimizer.gramsevamitra.com'],
    cnameTarget: 'gramsevamitra-optimizer.pages.dev',
    dnsHosts: ['optimizer'],
  },
  {
    project: 'gramsevamitra-resume',
    domains: ['resume.gramsevamitra.com'],
    cnameTarget: 'gramsevamitra-resume.pages.dev',
    dnsHosts: ['resume'],
  },
  {
    project: 'gramsevamitra-pdf',
    domains: ['pdf.gramsevamitra.com'],
    cnameTarget: 'gramsevamitra-pdf.pages.dev',
    dnsHosts: ['pdf'],
  },
];

const LIVE_URLS = [
  'https://gramsevamitra.com',
  'https://www.gramsevamitra.com',
  'https://optimizer.gramsevamitra.com',
  'https://resume.gramsevamitra.com',
  'https://pdf.gramsevamitra.com',
];

function getApiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  if (process.env.CLOUDFLARE_DNS_API_TOKEN) return process.env.CLOUDFLARE_DNS_API_TOKEN;
  try {
    const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8');
    const m = envFile.match(/^CLOUDFLARE_API_TOKEN=(.+)$/m);
    if (m?.[1]?.trim() && !m[1].includes('your_') && !m[1].includes('paste_')) {
      return m[1].trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env */
  }
  return null;
}

function getOAuthToken() {
  const paths = [
    join(homedir(), 'Library/Preferences/.wrangler/config/default.toml'),
    join(homedir(), '.wrangler/config/default.toml'),
  ];
  for (const p of paths) {
    try {
      const content = readFileSync(p, 'utf8');
      const m = content.match(/oauth_token = "([^"]+)"/);
      if (m) return m[1];
    } catch {
      /* next */
    }
  }
  return null;
}

function getToken() {
  return getApiToken() || getOAuthToken() || (() => {
    throw new Error('No Cloudflare token — run npm run cf:login or set CLOUDFLARE_API_TOKEN');
  })();
}

async function cf(token, path, opts = {}) {
  const url = path.startsWith('http') ? path : `https://api.cloudflare.com/client/v4${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.map((e) => e.message).join('; ') || res.statusText;
    throw new Error(msg);
  }
  return data;
}

async function getZoneId(token) {
  const data = await cf(token, `/zones?name=${ZONE_NAME}`);
  const zone = data.result?.[0];
  if (!zone) throw new Error(`Zone ${ZONE_NAME} not found in account`);
  return zone.id;
}

async function bindPagesDomains(token) {
  console.log('\n=== 1. Pages custom domain binding ===');
  for (const { project, domains } of PROJECTS) {
    for (const domain of domains) {
      try {
        await cf(token, `/accounts/${ACCOUNT_ID}/pages/projects/${project}/domains`, {
          method: 'POST',
          body: JSON.stringify({ name: domain }),
        });
        console.log(`✓ ${project} ← ${domain}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/already|duplicate|exists/i.test(msg)) {
          console.log(`  ${domain} already bound to ${project}`);
        } else {
          console.warn(`  ${domain}: ${msg}`);
        }
      }
    }
  }
}

function hostMatches(record, hosts) {
  const name = record.name.replace(`.${ZONE_NAME}`, '').replace(ZONE_NAME, '@');
  const normalized = name === '' ? '@' : name;
  return hosts.includes(normalized);
}

async function detachLegacyWorkerDomains(oauthToken) {
  console.log('\n=== 0. Detach legacy Worker custom domains ===');
  try {
    const { result } = await cf(oauthToken, `/accounts/${ACCOUNT_ID}/workers/domains`);
    for (const domain of result || []) {
      if (!domain.hostname?.includes('gramsevamitra.com')) continue;
      await cf(oauthToken, `/accounts/${ACCOUNT_ID}/workers/domains/${domain.id}`, {
        method: 'DELETE',
      });
      console.log(`✓ Detached Worker "${domain.service}" from ${domain.hostname}`);
    }
    if (!result?.length) console.log('  No Worker custom domains blocking Pages routing.');
  } catch (err) {
    console.warn(`  Worker detach skipped: ${err instanceof Error ? err.message : err}`);
  }
}

async function configureDns(token, zoneId) {
  console.log('\n=== 2. DNS zone record overrides ===');

  const allHosts = ['@', 'www', 'optimizer', 'resume', 'pdf'];
  let page = 1;
  const records = [];
  while (true) {
    const data = await cf(token, `/zones/${zoneId}/dns_records?per_page=100&page=${page}`);
    records.push(...(data.result || []));
    if (page >= (data.result_info?.total_pages || 1)) break;
    page++;
  }

  const toDelete = records.filter(
    (r) =>
      ['A', 'AAAA', 'CNAME'].includes(r.type) &&
      hostMatches(r, allHosts) &&
      !r.meta?.read_only
  );

  for (const rec of toDelete) {
    try {
      await cf(token, `/zones/${zoneId}/dns_records/${rec.id}`, { method: 'DELETE' });
      console.log(`  Deleted ${rec.type} ${rec.name} → ${rec.content}`);
    } catch (err) {
      console.warn(`  Skip delete ${rec.name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const readOnly = records.filter(
    (r) =>
      ['A', 'AAAA', 'CNAME'].includes(r.type) &&
      hostMatches(r, allHosts) &&
      r.meta?.read_only
  );
  for (const rec of readOnly) {
    console.warn(`  Read-only record remains: ${rec.type} ${rec.name} (managed by Cloudflare)`);
  }

  const cnames = [
    { name: ZONE_NAME, content: 'gramsevamitra-hub.pages.dev', host: '@' },
    { name: `www.${ZONE_NAME}`, content: 'gramsevamitra-hub.pages.dev', host: 'www' },
    { name: `optimizer.${ZONE_NAME}`, content: 'gramsevamitra-optimizer.pages.dev', host: 'optimizer' },
    { name: `resume.${ZONE_NAME}`, content: 'gramsevamitra-resume.pages.dev', host: 'resume' },
    { name: `pdf.${ZONE_NAME}`, content: 'gramsevamitra-pdf.pages.dev', host: 'pdf' },
  ];

  for (const { name, content, host } of cnames) {
    try {
      await cf(token, `/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CNAME',
          name,
          content,
          proxied: true,
          ttl: 1,
        }),
      });
      console.log(`✓ CNAME ${host} → ${content} (proxied)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate/i.test(msg)) {
        console.log(`  CNAME ${host} already exists`);
      } else {
        throw err;
      }
    }
  }
}

async function setPreviewRobots(token) {
  console.log('\n=== 3. Preview environment PUBLIC_ROBOTS ===');
  const projectNames = PROJECTS.map((p) => p.project);

  for (const name of projectNames) {
    const { result: project } = await cf(
      token,
      `/accounts/${ACCOUNT_ID}/pages/projects/${name}`
    );
    const preview = project.deployment_configs?.preview || { env_vars: {} };
    preview.env_vars = preview.env_vars || {};
    preview.env_vars.PUBLIC_ROBOTS = { value: 'noindex, nofollow' };

    const production = project.deployment_configs?.production || { env_vars: {} };
    production.env_vars = production.env_vars || {};
    delete production.env_vars.PUBLIC_ROBOTS;

    await cf(token, `/accounts/${ACCOUNT_ID}/pages/projects/${name}`, {
      method: 'PATCH',
      body: JSON.stringify({
        deployment_configs: { preview, production },
      }),
    });
    console.log(`✓ ${name}: Preview PUBLIC_ROBOTS=noindex,nofollow (production unchanged)`);
  }
}

async function purgeCache(token, zoneId) {
  console.log('\n=== 4. Global cache purge ===');
  await cf(token, `/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });
  console.log(`✓ Purged all cache for ${ZONE_NAME}`);
}

async function verifyEndpoints() {
  console.log('\n=== 5. Live propagation verification ===');
  const expectedTitle = 'GramSeva Mitra';

  for (const url of LIVE_URLS) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const robots = res.headers.get('x-robots-tag') || '(header pending)';
      const html = await res.text();
      const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || '(no title)';
      const isNew =
        title.includes('Digital Empowerment') ||
        title.includes('Document Optimizer') ||
        title.includes('ATS Resume') ||
        title.includes('PDF Micro-Tools') ||
        title.includes('GramSeva Mitra —');
      const status = isNew ? 'NEW toolkit' : `OLD/other (${title.slice(0, 50)})`;
      console.log(`${url}`);
      console.log(`  HTTP ${res.status} | X-Robots-Tag: ${robots} | ${status}`);
    } catch (err) {
      console.log(`${url} → ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function verifyDomainStatus(token) {
  console.log('\n=== Pages domain verification status ===');
  for (const { project, domains } of PROJECTS) {
    const { result } = await cf(
      token,
      `/accounts/${ACCOUNT_ID}/pages/projects/${project}/domains`
    );
    for (const d of domains) {
      const row = result?.find((x) => x.name === d);
      console.log(`  ${d}: ${row?.status || 'not found'} ${row?.verification_data?.status || ''}`);
    }
  }
}

async function main() {
  console.log('GramSeva Mitra — DNS & routing configuration');
  console.log(`Account: ${ACCOUNT_ID}`);

  const apiToken = getApiToken();
  const oauthToken = getOAuthToken();
  const dnsToken = apiToken || oauthToken;
  const pagesToken = oauthToken || apiToken;

  if (!dnsToken) throw new Error('No Cloudflare credentials available.');

  console.log(`Auth: API token ${apiToken ? '✓ (DNS/purge)' : '—'} | OAuth ${oauthToken ? '✓ (Pages)' : '—'}`);

  const zoneId = await getZoneId(dnsToken);
  console.log(`Zone ID: ${zoneId}`);

  if (oauthToken) {
    await detachLegacyWorkerDomains(oauthToken);
    await bindPagesDomains(oauthToken);
    await setPreviewRobots(oauthToken);
  } else {
    console.log('\n=== Pages API skipped (OAuth not available; domains already bound) ===');
  }

  await configureDns(dnsToken, zoneId);
  await purgeCache(dnsToken, zoneId);

  console.log('\nWaiting 15s for DNS/edge propagation…');
  await new Promise((r) => setTimeout(r, 15000));

  await verifyDomainStatus(pagesToken).catch(() => {
    console.log('\n=== Pages domain status skipped (use OAuth for Pages API) ===');
  });
  await verifyEndpoints();
  console.log('\n✓ Routing configuration complete.');
}

main().catch((err) => {
  console.error(`\nRouting failed: ${err instanceof Error ? err.message : err}`);
  if (/Authentication|auth/i.test(String(err))) {
    console.error('OAuth token may lack DNS:Edit — create an API token with Zone DNS Edit + Cache Purge.');
  }
  process.exit(1);
});
