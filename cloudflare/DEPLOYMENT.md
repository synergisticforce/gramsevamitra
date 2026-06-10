# Cloudflare Pages — GramSeva Mitra Multi-Tenant Deployment

Deploy each app as a **separate Cloudflare Pages project** pointing at the same Git repository with different build settings.

## Projects Overview

| Project Name | Custom Domain | Root Directory | Build Command | Output Directory |
|---|---|---|---|---|
| `gramsevamitra-hub` | `gramsevamitra.com` | `apps/hub` | `npm ci && npm run build --workspace=@gramsevamitra/hub` | `dist` |
| `gramsevamitra-optimizer` | `optimizer.gramsevamitra.com` | `apps/optimizer` | `npm ci && npm run build --workspace=@gramsevamitra/optimizer` | `dist` |
| `gramsevamitra-resume` | `resume.gramsevamitra.com` | `apps/resume` | `npm ci && npm run build --workspace=@gramsevamitra/resume` | `dist` |

## Monorepo Build (from repository root)

```bash
npm ci
node scripts/sync-public.mjs
node scripts/generate-pwa-icons.mjs
npm run build
```

## Environment Variables (all projects)

Set in Cloudflare Pages → Settings → Environment variables:

```
PUBLIC_RAZORPAY_KEY_ID=rzp_live_xxxxx
PUBLIC_INSTAMOJO_PAYMENT_LINK=https://www.instamojo.com/@your-handle/
PUBLIC_OPTIMIZER_PRICE_PAISE=2900
PUBLIC_RESUME_SINGLE_PRICE_PAISE=4900
PUBLIC_RESUME_MONTHLY_PRICE_PAISE=19900
```

**Preview vs Production robots:** Cloudflare `_headers` matches URL paths only (not hostnames). For `*.pages.dev` preview URLs, set `PUBLIC_ROBOTS=noindex, nofollow` on **Preview** environment variables in each Pages project. Leave unset (defaults to `index, follow`) on **Production**.

## DNS (Cloudflare)

For each custom domain, add a CNAME record pointing to the Pages project subdomain:

```
gramsevamitra.com          → gramsevamitra-hub.pages.dev
optimizer.gramsevamitra.com → gramsevamitra-optimizer.pages.dev
resume.gramsevamitra.com    → gramsevamitra-resume.pages.dev
```

## Robots & Preview URL Protection

Each app ships `public/_headers` with:

- **Production custom domains:** `X-Robots-Tag: index, follow`
- **\*.pages.dev preview URLs:** `X-Robots-Tag: noindex, nofollow`

This prevents duplicate-content penalties from Cloudflare preview deployments.

## PWA / Offline

`vite-plugin-pwa` generates `manifest.webmanifest` and `sw.js` (Workbox) at build time. Icons live in each app's `public/` folder.

## CI Example (GitHub Actions)

See `.github/workflows/deploy.yml` for automated builds.
