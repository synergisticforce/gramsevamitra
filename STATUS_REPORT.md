# GramSevaMitra status

Updated: 14 November 2026. The public site now opens on a daylight four-door home screen. Studios ask for the task before the file. Details are in `UI_UX_AUDIT.md`.

Repository: `synergisticforce/gramsevamitra`.  
Live site: `https://www.gramsevamitra.com`, Cloudflare Pages project `gramsevamitra-hub`.  
Deploy path: GitHub `main` → `.github/workflows/deploy.yml` → Cloudflare Pages. There is no Python server.

This file describes the code in the repository. A change reaches the live site only after it is committed and pushed to `main`.

# Stack

- Site: Astro 4, React 18, TypeScript, Tailwind, in `apps/hub/`.
- API: Cloudflare Pages Functions in `functions/`. Shared modules are `functions/_lib/*.mjs`, re-exported from `apps/hub/src/lib/audit/`.
- Database: Neon PostgreSQL only, via `DATABASE_URL`. Schema: `schema.postgres.sql`. Tables are created with `CREATE TABLE IF NOT EXISTS` from `functions/_lib/neonSchema.mjs` and `functions/_lib/auditDb.mjs`. Cloudflare D1 is not used.
- Money: integer paise and integer basis points in `functions/_lib/currency.mjs` and `apps/hub/src/lib/audit/currency.ts`. ₹1.00 is 100 paise. 18% is 1800 bps.
- Phone shell: Capacitor. Native calls stay behind `Capacitor.isNativePlatform()`.

# What is built

## Phase 0A and 0B

- Accounts and credits use Neon. The D1 binding is gone from `wrangler.toml`.
- `/` is the Finance Hub gateway. `apps/hub/public/_redirects` does not send `/` to Document Studio. Old `/tools` links still do.
- `/workspace/finance` leads with the restaurant, seller, and munshi paths, then the 16 calculators, sample Swiggy, Zomato, and Flipkart figures, and a live file check.
- Career Prep scores a resume in the browser. `/api/pro/career-ai` calls `gemini-3.5-flash-lite` first for English and `sarvam-105b` first for an Indian language. Guests get 3 free generations a month, tracked with the `gsm_device_id` cookie and a hashed IP. Credits are charged only after a non-empty Pro reply.
- Image Studio removes the background, upscales 2× and 4×, and restores a photo on the device, with progress and cancel.
- Document Studio converts a digital PDF to `.xlsx`, `.csv`, `.docx`, `.txt`, or `.md` in the browser. A scan is accepted from on-device Tesseract only at 95% confidence and aligned columns. Otherwise `/api/pro/document-smart-convert` tries Azure Document Intelligence, then Sarvam Vision, then `gemini-3.5-flash-lite`, then `gemini-2.5-flash-lite`.

## Phase 1

Integer money, audit types, and Neon audit tables.

- `functions/_lib/currency.mjs`
- `apps/hub/src/lib/audit/currency.ts`
- `apps/hub/src/lib/audit/types.ts`
- `functions/_lib/auditDb.mjs`
- `scripts/test-phase1-audit.mjs`

## Phase 2

Restaurant checks, seller checks, claim text, and the tax export.

- `functions/_lib/restaurantAuditor.mjs` and `apps/hub/src/lib/audit/restaurantAuditor.ts`
- `functions/_lib/ecommerceAuditor.mjs` and `apps/hub/src/lib/audit/ecommerceAuditor.ts`
- `functions/_lib/claimGenerator.mjs` and `apps/hub/src/lib/audit/claimGenerator.ts`
- `functions/_lib/taxAutopilot.mjs` and `apps/hub/src/lib/audit/taxAutopilot.ts`
- `scripts/test-phase2-auditors.mjs`

## Phase 3

Workbook adapters. Customer name, phone, and address columns are dropped. Total rows are dropped. Parsing runs in the browser.

- `functions/_lib/adapters/baseAdapter.mjs`
- `functions/_lib/adapters/swiggyAdapter.mjs`
- `functions/_lib/adapters/zomatoAdapter.mjs`
- `functions/_lib/adapters/ecommerceAdapters.mjs` (Meesho, Flipkart settlement, Amazon, Shopify)
- `functions/_lib/adapters/registry.mjs`
- Matching files under `apps/hub/src/lib/audit/adapters/`
- `scripts/test-phase3-adapters.mjs`

## Phase 4

PDF page limits, header cache, one-cell correction, and cloud OCR routing.

- `functions/_lib/pdfRouter.mjs` and `apps/hub/src/lib/audit/pdfRouter.ts` — `@cantoo/pdf-lib` splits a PDF into chunks of at most 10 pages and slices at most 2 pages. PDF.js reads a digital text layer. A missing text layer or a KrutiDev-style font returns `NEEDS_OCR`.
- `functions/_lib/headerMapper.mjs` and `apps/hub/src/lib/audit/headerMapper.ts` — SHA-256 of the sorted headers. The mapping is reused from memory, then from the Neon `header_mapping_cache` table. A miss uses the alias list, or `gemini-3.5-flash-lite` when a key is set and a header is still unknown. Only the headers and up to 3 scrubbed sample rows are sent.
- `functions/_lib/selfHealingCrop.mjs` and `apps/hub/src/lib/audit/selfHealingCrop.ts` — an OCR row that misses by more than ₹1 is queued. With no munshi id the cell is assigned to `ADMIN` and the restaurant owner gets a confirm button, not a ledger form. With a munshi id it is assigned to `MUNSHI`. Confirming `9.75` writes 975 paise and re-runs the auditor.
- `functions/_lib/cloudOcrArbitrage.mjs` and `functions/api/audit/ocr-extract.js` — English scans with an Azure key are cut to 2 pages. Longer scans are cut into 10-page chunks. The reader order remains Azure, Sarvam Vision, `gemini-3.5-flash-lite`, then `gemini-2.5-flash-lite`.
- Finance Hub upload accepts `.xlsx`, `.csv`, and `.pdf`. A row marked `NEEDS_VERIFICATION` shows a one-cell card. Confirming it calls `resolveCellVerification`.
- `scripts/test-phase4-ocr-pipeline.mjs` passed on 9 November 2026: 25-page PDF became page counts 10, 10, and 5; the 2-page slice returned 2 pages; the KrutiDev sample was flagged and clean English and Hindi were not; the second header map was a cache hit; the ₹975.00 tax misread healed to 975 paise with no horizontal error.

## Phase 5

Evidence workbook, freemium unlock, and the audit API.

- `functions/_lib/evidencePack.mjs` and `apps/hub/src/lib/audit/evidencePack.ts` build a 4-tab `.xlsx`: Executive Summary & UTR Bridge, Line-by-Line Dispute Proof, Held Orders Checklist, and Tax Autopilot & Tally.
- `functions/_lib/unlockEngine.mjs` and `apps/hub/src/lib/audit/unlockEngine.ts` open a check for free when the recoverable amount is under ₹200. At ₹200 or more, the first finding stays readable and the other order ids are masked. The standard unlock fee is 10% (`applyBps(..., 1000)`). A linked munshi receives 30%. A rejected claim refunds its share of that fee. The UPI mandate authorises ₹1 and sets a day-10 reminder, a day-12 pre-debit notice, and a day-14 collection.
- `functions/_lib/auditRepository.mjs` saves an upload in Neon when `DATABASE_URL` is set, and in memory when it is not.
- Pages Functions: `functions/api/audit/upload.js`, `create-unlock-checkout.js`, `unlock.js`, `resolve-cell.js`, `mark-rejected.js`, and `munshi-dashboard.js`.
- Finance Hub shows the teaser, an Unlock All Claims button, the ₹1 mandate request, and the evidence-pack and Tally downloads after unlock.
- `scripts/test-phase5-api.mjs` passed on 9 November 2026.

## Phase 6

Owner, munshi, seller, and admin screens.

- The header on every studio page has doors for `/owner/`, `/seller/`, `/munshi/`, Finance Hub, and the free studios, plus an English/Hindi switch and a `123` / `१२३` switch saved in `localStorage`.
- `/owner/` is the large-type daylight check: file drop, Swiggy and Zomato samples, a wrong-file card, held-order alert, green and blue pockets, a ₹1 mandate screen, and WhatsApp, copy, and evidence-pack actions after unlock.
- `/munshi/` is the partner desk: 30% wallet, many-file drop, client filters, WhatsApp magic link, and the one-cell check.
- `/seller/` is the Meesho, Flipkart, Amazon, and Shopify view: order-item waterfall, weight override, NEFT bridge, and GST/TCS/TDS cards.
- `/admin/` confirms an owner cell that has no munshi, including the ₹975.00 versus ₹9.75 misread.
- `functions/_lib/ownerExperience.mjs` builds the WhatsApp text, the grouped rupee text, and the munshi bulk-file states.
- `scripts/test-phase6-ui.mjs` checks those rules and the built pages.

## Phase 7 and 8

Seller tools, legal pages, and the health check.

- Quick Tools adds a 4×6 inch shipping-label cropper and a courier slab calculator. Both run on the device and link to `/seller/`.
- Document, image, video, career, lifestyle, and quick-tools pages show a short banner to the restaurant, seller, and munshi checks.
- `apps/hub/public/manifest.json` accepts shared `.xlsx`, `.csv`, and `.pdf` files. `apps/hub/public/share-target.js` stores a shared file and opens `/owner/?shared=1`. `OwnerVisualPWA` reads `gsm-share` / `/shared-payout-file` and runs the live audit pipeline.
- Privacy, terms, and refund pages say November 2026. Accounts are Neon PostgreSQL. Customer name, phone, and address columns are stripped in the browser. A rejected claim fee can be refunded within 14 days, then Razorpay returns it in 5–7 business days.
- `/about/`, `/pricing/`, and `/contact/` are public. The footer links About, Pricing, Privacy, Terms, Refund, and Contact.
- `GET /api/health` reports whether Neon and the AI keys are set, and whether Razorpay is live or test, without returning the secrets.
- `scripts/test-phase7-8-final.mjs` covers the slab math, the label crop, the legal pages, and the health report.

## Opus 5.5 xhigh audit (14 November 2026)

- Legacy mock Pro routes (`media-process`, `ocr-orchestrator`, `reconstruct-layout`, and their `/upload` companions) hard-block with `HTTP 503`, `FEATURE_NOT_AVAILABLE`, `creditsCharged: 0` before any credit gate — matching `extract` / `smart-extract` / `file-converter` / `smart-router`.
- `/api/audit/ocr-extract` enforces `guest_ai_quotas` (`payout-ocr`, 2 free/month) and releases the quota when cloud OCR fails.
- `toMinorUnits` rejects Excel formula errors (`#REF!`, `#VALUE!`, …). CSV UTF-8 BOM is stripped. Bare `Address` is scrubbed as PII.
- Document Studio OCR gate remains `DOCUMENT_CONFIDENCE_MIN = 95` (never 85).
- Full detail: `AUDIT_REPORT_OPUS.md`. Check: `node scripts/test-opus-audit.mjs`.

## Post-Opus operational closure (14 November 2026)

- Cloud OCR responses from `/api/audit/ocr-extract` pass through `scrubOcrOutputPii` in `functions/_lib/cloudOcrArbitrage.mjs` before they are returned. Customer-name and address columns are dropped. Indian mobiles and emails in free text become `[REDACTED_PHONE]` and `[REDACTED_EMAIL]`. Raw PDF bytes are not written to logs.
- `POST /api/audit/munshi-withdraw` records a UPI payout request in `munshi_payout_requests` (Neon, or memory when `DATABASE_URL` is unset) up to the available 30% wallet. `/munshi/` has a Withdraw to UPI button. `/admin/` lists pending requests and settles one with a click.
- A completed `PRO_299` checkout (`29900` paise) sets `tenant_accounts.subscription_tier = 'PRO_299'` and credits the linked munshi `8970` paise. A Pro tenant's unlock fee is 5% (`500` bps).
- `POST /api/audit/process-trust-clock` marks an authorised ₹1 mandate `DUE_FOR_COLLECTION` when day 14 has passed and File 2 was not uploaded. `/admin/` runs that check when the page opens, and again from the button. Opening `/api/audit/munshi-dashboard` runs it too. `.github/workflows/trust-clock-cron.yml` pings the same endpoint every day at 02:00 IST (`30 20 * * *` UTC). `wrangler.toml` has no `[triggers]` block, because Cloudflare Pages does not run cron from that file.
- Settling a munshi withdrawal stores an optional bank or UPI `settlement_utr` and a `settled_at` timestamp.
- A 2,000-row Swiggy workbook (merged title cell, blank spacer rows, `Adjusment Type`, `GRAND TOTAL`) audited in **28 ms** on 14 November 2026. Check: `node scripts/test-post-opus-closure.mjs`.

# Still outside this tree

- The separate Flutter Docs Studio app is not this repository. It uses the same Android package id.
- Do not add FastAPI, SQLAlchemy, or openpyxl. Spreadsheets use SheetJS.
- Do not hard-code `sarvam-30b`, `gemini-3-flash`, or `gemini-2.5-flash`.

# Check before calling a phase done

```bash
node scripts/test-phase1-audit.mjs
node scripts/test-phase2-auditors.mjs
node scripts/test-phase3-adapters.mjs
node scripts/test-phase4-ocr-pipeline.mjs
node scripts/test-phase5-api.mjs
node scripts/test-phase6-ui.mjs
node scripts/test-phase7-8-final.mjs
node scripts/test-opus-audit.mjs
node scripts/test-post-opus-closure.mjs
node scripts/test-ux-and-all-tools.mjs
npm run typecheck
npm run build
```

Update this file at the end of every phase.
