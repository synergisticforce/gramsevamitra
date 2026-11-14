# GramSevaMitra web app

Updated: 14 November 2026. This replaces the 17 October 2026 blueprint. Older plans live in `archive_docs/`, including `CURRENT_STATE_BLUEPRINT.md` and `MASTER_BIBLE.md`. Opus 5.5 `xhigh` hardening is in `AUDIT_REPORT_OPUS.md`.

The live site is [https://www.gramsevamitra.com](https://www.gramsevamitra.com). GitHub `main` deploys through `.github/workflows/deploy.yml` to Cloudflare Pages project `gramsevamitra-hub`.

# What a person can do

- Open `/` and choose a restaurant payout check, a seller payout check, or the munshi desk, then use the free studios.
- Check a Swiggy, Zomato, Meesho, Flipkart, Amazon, or Shopify Excel or CSV on the device at `/workspace/finance`. A PDF with real text is read on the device. A scan goes to `/api/audit/ocr-extract` only when a cloud key is set.
- Score a resume on the device at `/workspace/career`, and generate a resume, cover letter, or interview answers with 3 free tries a month.
- Remove a background, upscale 2× or 4×, or restore a photo on the device at `/workspace/image`.
- Turn a digital PDF into Excel, CSV, Word, text, or Markdown on the device at `/workspace/documents`. A scan stays on the device when Tesseract is at least 95% confident and the columns line up.

Sign-in is optional for those free tools.

# Stack

| Layer | What it is |
|---|---|
| Site | Astro 4, React 18, TypeScript, Tailwind, in `apps/hub/` |
| API | Cloudflare Pages Functions in `functions/` |
| Shared audit code | `functions/_lib/` and `apps/hub/src/lib/audit/` |
| Database | Neon PostgreSQL (`DATABASE_URL`, `schema.postgres.sql`). No Cloudflare D1 |
| Money | Integer paise and basis points. No floating-point currency |
| Spreadsheets | SheetJS in the browser |
| PDFs | `@cantoo/pdf-lib` and PDF.js |
| Phone shell | Capacitor, Android-first |
| Models | `gemini-3.5-flash-lite`, `sarvam-105b`, Azure Document Intelligence, Sarvam Vision. `gemini-2.5-flash-lite` is only the last document fallback |

Do not add a Python or FastAPI server. Cloudflare Pages will not run it.

# Payout check files

| Piece | Path |
|---|---|
| Paise maths | `functions/_lib/currency.mjs` |
| Neon audit tables | `functions/_lib/auditDb.mjs` |
| Restaurant checks | `functions/_lib/restaurantAuditor.mjs` |
| Seller checks | `functions/_lib/ecommerceAuditor.mjs` |
| Claim text | `functions/_lib/claimGenerator.mjs` |
| Tax export | `functions/_lib/taxAutopilot.mjs` |
| Swiggy, Zomato, Meesho, Flipkart, Amazon, Shopify | `functions/_lib/adapters/` |
| PDF split and digital text | `functions/_lib/pdfRouter.mjs` |
| Header cache | `functions/_lib/headerMapper.mjs` |
| One-cell OCR correction | `functions/_lib/selfHealingCrop.mjs` |
| Cloud OCR route | `functions/_lib/cloudOcrArbitrage.mjs`, `functions/api/audit/ocr-extract.js` |
| 4-tab evidence pack | `functions/_lib/evidencePack.mjs` |
| Free under ₹200, teaser, ₹1 mandate, munshi 30%, refund | `functions/_lib/unlockEngine.mjs` |
| Audit save | `functions/_lib/auditRepository.mjs`, `functions/api/audit/` |

Each shared module has a typed re-export under `apps/hub/src/lib/audit/`.

The phone and desktop bars no longer list the same studios twice. Document Studio, Finance Hub, and Quick Tools keep the everyday actions open and tuck the rest behind one drawer. Merge keeps its buttons on screen while the file list scrolls. See `UI_UX_AUDIT.md`.

Checks: `scripts/test-phase1-audit.mjs` through `scripts/test-phase7-8-final.mjs`, plus `scripts/test-opus-audit.mjs`, `scripts/test-post-opus-closure.mjs`, and `scripts/test-ux-and-all-tools.mjs`. A 2,000-row Swiggy workbook audits in 28 ms. Cloud OCR output is scrubbed before it is returned. Munshi UPI withdrawals and the 14-day trust clock are admin actions on `/munshi/` and `/admin/`.

## Share target (Android PWA)

1. `apps/hub/public/manifest.json` — `share_target` POSTs `multipart/form-data` to `/owner/` for `.pdf` / `.csv` / `.xlsx`.
2. Service worker imports `apps/hub/public/share-target.js`, caches the file at `/shared-payout-file` under `gsm-share`, and redirects to `/owner/?shared=1` (avoids HTTP 405 on static `/owner/`).
3. `OwnerVisualPWA` reads that cache entry, runs the client audit pipeline, then clears the cache.

## Hard-blocked legacy Pro routes

`/api/pro/media-process`, `/ocr-orchestrator`, `/reconstruct-layout`, `/extract`, `/smart-extract`, `/file-converter`, `/smart-router`, and their `/upload` companions return `503` + `FEATURE_NOT_AVAILABLE` + `creditsCharged: 0` before any credit gate.

Phases 0A through 8 are in this repository. The public pages are `/owner/`, `/seller/`, `/munshi/`, `/admin/`, `/about/`, `/pricing/`, `/contact/`, `/privacy/`, `/terms/`, and `/refund-policy/`. `GET /api/health` reports configuration without secrets. The current build state is `STATUS_REPORT.md`. Update that file at the end of every phase.
