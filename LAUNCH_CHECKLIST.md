# GramSeva Mitra — Production Launch Checklist

Use this list when configuring **Cloudflare Pages**, **D1**, **Google OAuth**, **Stripe**, and **CI** before going live. Values marked **Secret** must be stored as **Encrypted** Pages secrets (Production + Preview), not plain text in the repo.

---

## 1. Cloudflare Pages projects (4 apps)

| Pages project | Custom domains | Build output | Needs `/functions`? |
|---|---|---|---|
| `gramsevamitra-hub` | `gramsevamitra.com`, `www.gramsevamitra.com`, `utilities.gramsevamitra.com` | `apps/hub/dist` | **Yes** — auth, billing, contact, Smart Router |
| `gramsevamitra-pdf` | `pdf.gramsevamitra.com` | `apps/pdf/dist` | No |
| `gramsevamitra-optimizer` | `optimizer.gramsevamitra.com` | `apps/optimizer/dist` | No |
| `gramsevamitra-resume` | `resume.gramsevamitra.com` | `apps/resume/dist` | No |

**Hub monorepo settings (critical):** Point the Git build at the **repository root** (not `apps/hub`) so Cloudflare picks up `/functions` and root `wrangler.toml` bindings.

| Setting | Value |
|---|---|
| Root directory | `/` (repo root) |
| Build command | `npm ci && node scripts/sync-public.mjs && node scripts/generate-pwa-icons.mjs && npm run build:hub` |
| Build output directory | `apps/hub/dist` |
| Wrangler config (direct deploy) | `wrangler.toml` at repo root |

**Direct deploy fallback (local):**

```bash
npm run build:hub
npx wrangler pages deploy apps/hub/dist --project-name=gramsevamitra-hub --config wrangler.toml --branch=main
```

---

## 2. D1 database binding (hub only)

Apply schema once: `schema.sql` → database `gramsevamitra-auth`.

| Dashboard field | Value |
|---|---|
| Binding name | `DB` |
| Database name | `gramsevamitra-auth` |
| Database ID | `df383016-db6c-4761-97ec-58a16c75efa5` *(from `wrangler.toml`; create a new DB if yours differs)* |

**CLI (one-time schema):**

```bash
npx wrangler d1 execute gramsevamitra-auth --remote --file=schema.sql
```

Tables: `users` (includes `plan`, `credits`), `sessions`, `accounts`, `verifications`.

---

## 3. Hub — plain environment variables

Set under **Pages → gramsevamitra-hub → Settings → Environment variables**.

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `BETTER_AUTH_URL` | `https://gramsevamitra.com` | Same or preview URL | Must match the origin users sign in from |
| `PUBLIC_PAYMENTS_ENABLED` | `true` | `true` | Legacy Razorpay/Instamojo gate (Stripe Pro uses server checkout) |
| `PUBLIC_RAZORPAY_KEY_ID` | `disabled` or live key | `disabled` | Stub unless legacy optimizer/resume payments enabled |
| `PUBLIC_INSTAMOJO_PAYMENT_LINK` | `https://example.com/disabled` | Same | Stub unless legacy payments enabled |
| `PUBLIC_OPTIMIZER_PRICE_PAISE` | `0` or live price | Same | Optimizer app |
| `PUBLIC_RESUME_SINGLE_PRICE_PAISE` | `0` or live price | Same | Resume app |
| `PUBLIC_RESUME_MONTHLY_PRICE_PAISE` | `0` or live price | Same | Resume app |
| `PUBLIC_ROBOTS` | *(unset — index, follow)* | `noindex, nofollow` | Prevents preview URL duplicate indexing |

Also defined in root `wrangler.toml` `[vars]` for Wrangler deploys: `BETTER_AUTH_URL`.

---

## 4. Hub — encrypted secrets (Pages secrets)

Set via **Dashboard → Encrypted variables** or:

```bash
npx wrangler pages secret put <NAME> --project-name=gramsevamitra-hub
```

| Secret | Required | Used by |
|---|---|---|
| `BETTER_AUTH_SECRET` | **Yes** | Better Auth session signing (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | **Yes** | Google OAuth sign-in |
| `GOOGLE_CLIENT_SECRET` | **Yes** | Google OAuth sign-in |
| `STRIPE_SECRET_KEY` | **Yes** (Pro billing) | `POST /api/billing/checkout`, webhook |
| `STRIPE_WEBHOOK_SECRET` | **Yes** (Pro billing) | `POST /api/billing/webhook` |
| `STRIPE_PRICE_ID` | Optional | Pre-created Stripe Price; omit to use inline ₹199/mo INR |
| `TURNSTILE_SECRET_KEY` | **Yes** (contact form) | `POST /api/contact` bot verification |
| `RESEND_API_KEY` | **Yes** (contact form) | Sends mail to `contact@gramsevamitra.com` |

`scripts/force-deploy.js` uploads all of the above automatically when `.env` is populated locally.

---

## 5. Google Cloud Console (OAuth)

Create an OAuth 2.0 **Web client** and add authorized origins + redirect URIs:

| Type | URI |
|---|---|
| JavaScript origin | `https://gramsevamitra.com` |
| JavaScript origin | `https://utilities.gramsevamitra.com` |
| Redirect URI | `https://gramsevamitra.com/api/auth/callback/google` |
| Redirect URI | `https://utilities.gramsevamitra.com/api/auth/callback/google` |

Copy **Client ID** → `GOOGLE_CLIENT_ID`, **Client secret** → `GOOGLE_CLIENT_SECRET`.

---

## 6. Stripe (Pro subscription — test or live)

| Item | Value |
|---|---|
| Product | Pro subscription (₹199/month INR) |
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
| `STRIPE_PRICE_ID` | Optional `price_…` for the Pro plan |
| Webhook endpoint | `https://gramsevamitra.com/api/billing/webhook` |
| Webhook events | `checkout.session.completed` (minimum) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from the webhook (`whsec_…`) |

After checkout, webhook sets `users.plan = 'pro'` in D1. Smart Router (`POST /api/pro/smart-router`) requires `plan === 'pro'`.

---

## 7. Cloudflare Turnstile (contact form)

| Item | Where |
|---|---|
| Site key (public) | Hardcoded in `apps/hub/src/pages/contact.astro` — replace if you rotate keys |
| Secret key | `TURNSTILE_SECRET_KEY` Pages secret |

---

## 8. Resend (contact email)

| Item | Value |
|---|---|
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| From address | `onboarding@resend.dev` (dev) or verified domain in production |
| To address | `contact@gramsevamitra.com` (code default) |

---

## 9. Optimizer / Resume / PDF — environment variables

These projects are static Astro builds; no D1 or `/functions`.

| Variable | All three | Notes |
|---|---|---|
| `PUBLIC_RAZORPAY_KEY_ID` | Optional | Legacy payment UI |
| `PUBLIC_INSTAMOJO_PAYMENT_LINK` | Optional | Legacy payment UI |
| `PUBLIC_OPTIMIZER_PRICE_PAISE` | Optimizer only | Price in paise |
| `PUBLIC_RESUME_SINGLE_PRICE_PAISE` | Resume only | |
| `PUBLIC_RESUME_MONTHLY_PRICE_PAISE` | Resume only | |
| `PUBLIC_ROBOTS` | Preview only | `noindex, nofollow` on branch previews |

---

## 10. DNS (Cloudflare zone: `gramsevamitra.com`)

| Host | Type | Target |
|---|---|---|
| `@` | CNAME | `gramsevamitra-hub.pages.dev` |
| `www` | CNAME | `gramsevamitra-hub.pages.dev` |
| `utilities` | CNAME | `gramsevamitra-hub.pages.dev` |
| `pdf` | CNAME | `gramsevamitra-pdf.pages.dev` |
| `optimizer` | CNAME | `gramsevamitra-optimizer.pages.dev` |
| `resume` | CNAME | `gramsevamitra-resume.pages.dev` |

Automate: `npm run configure:routing` (needs token with Pages + DNS permissions).

---

## 11. GitHub Actions / local deploy (optional)

| Secret / env | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | CI deploy + API scripts (Pages:Edit, Account:Read) |
| `CLOUDFLARE_ACCOUNT_ID` | `b440186dd17095f27299d6fb3bfcc663` *(verify in dashboard)* |
| `CLOUDFLARE_DNS_API_TOKEN` | Optional alias for routing script |
| `CF_PAGES_BRANCH` | Optional; defaults to `main` |

Local `.env` (never commit): copy from `.env.example` and fill values for `force-deploy` / `production-release`.

---

## 12. Pre-launch smoke tests

- [ ] Sign in with Google on `https://gramsevamitra.com`
- [ ] Contact form submits (Turnstile + Resend)
- [ ] Stripe checkout completes; D1 `users.plan` becomes `pro`
- [ ] Pro ⚡ button opens upgrade modal (free user) or Smart Router (Pro user)
- [ ] `POST /api/pro/smart-router` returns **403** for free users, **200** for Pro
- [ ] All four domains serve with `X-Robots-Tag: index, follow` on production
- [ ] Preview `*.pages.dev` URLs use `noindex, nofollow`
- [ ] `npm run build:all` passes locally

---

## 13. Future GPU integration (not required for launch)

When replacing mock engines in `functions/_lib/smartRouter.mjs`, add secrets for Modal / Hugging Face / Google Cloud Vision API as needed. No env vars are consumed yet for live GPU endpoints.
