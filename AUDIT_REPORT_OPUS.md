# AUDIT_REPORT_OPUS.md

Independent Principal Full-Stack Architect audit of live `gramsevamitra.com` v2.0.0 (Phases 0A–8), Claude Opus 5.5 `xhigh`.

**Date:** 14 November 2026  
**Architecture lock (unchanged):** GitHub `main` → `.github/workflows/deploy.yml` → Cloudflare Pages `gramsevamitra-hub`. No Python/FastAPI server. Neon PostgreSQL via `DATABASE_URL`. Integer paise + basis points. Client-first SheetJS/PDF.js. Tesseract gate **≥ 95.0%** (never 85%).

**Verification:** `node scripts/test-opus-audit.mjs` + phase1–phase7-8 scripts + `npm run typecheck` + `npm run build` — all green.

---

## Summary

| Severity | Found | Fixed |
|---|---|---|
| Critical | 2 | 2 |
| High | 3 | 3 |
| Medium | 3 | 3 |
| Low | 2 | noted / partial |

Cloudflare-native payout engine, freemium unlock, and multi-tier Razorpay paths (`TRUST_CLOCK_MANDATE` ₹1 / `ONE_TAP_UPI` / `PRO_299` ₹299 / Studio Pro ₹99) were already correct. No floating-point rupee math in audit money paths. The main gaps were incomplete hard-blocks on mock Pro routes, missing share-target consumption on `/owner/`, payout OCR without guest quota, and spreadsheet edge-case hardening.

---

## Findings

### 1. Critical — Mock Pro routes could still reach credit gates

| Field | Value |
|---|---|
| **File Path** | `functions/api/pro/media-process.js`, `functions/api/pro/ocr-orchestrator.js`, `functions/api/pro/reconstruct-layout.js` (+ `/upload.js` companions) |
| **Line Number(s)** | Was: `requireEngine` then `requireProCredits` (e.g. former media-process L37–44). Now: L7–17 hard-block in each file. |
| **Severity** | Critical |
| **Description** | Unlike `extract.js` / `smart-extract.js` / `file-converter.js` / `smart-router.js`, these three used `requireEngine()`. If `MEDIA_AI_ENDPOINT` (or related) was set in Cloudflare, the mock pipeline ran after a credit gate. Upload companions also called `requireProCredits` first. |
| **Fix Applied** | Replaced handlers with immediate `HTTP 503`, `code: FEATURE_NOT_AVAILABLE`, `creditsCharged: 0` before any credit or storage work. Same for `media-process/upload.js`, `reconstruct-layout/upload.js`, `smart-extract/upload.js`, `file-converter/upload.js`. |
| **Verification Status** | FIXED & TESTED (`scripts/test-opus-audit.mjs`) |

### 2. Critical — Android PWA share_target file never opened on `/owner/`

| Field | Value |
|---|---|
| **File Path** | `apps/hub/src/components/finance/OwnerVisualPWA.tsx`, `apps/hub/public/share-target.js` |
| **Line Number(s)** | share-target.js L1–26; OwnerVisualPWA share `useEffect` (loads `/shared-payout-file`) |
| **Severity** | Critical |
| **Description** | Manifest `share_target` POSTs to `/owner/`. SW cached the file and redirected to `?shared=1`, but OwnerVisualPWA never read `caches.open('gsm-share')`, so WhatsApp shares landed on an empty intake screen. |
| **Fix Applied** | On `?shared=1`, OwnerVisualPWA reads the cached `File`, runs the full audit pipeline, deletes the cache entry, and strips the query param. `share-target.js` also normalizes `/owner` vs `/owner/`. |
| **Verification Status** | FIXED & TESTED |

### 3. High — Payout cloud OCR had no guest quota

| Field | Value |
|---|---|
| **File Path** | `functions/api/audit/ocr-extract.js` |
| **Line Number(s)** | Full rewrite; `reserveGuestQuota(..., 'payout-ocr', 2)` and `releaseGuestQuota` on failure |
| **Severity** | High |
| **Description** | Document Studio enforced `guest_ai_quotas` via `document-smart-convert.js`. Payout `/api/audit/ocr-extract` called Azure/Sarvam/Gemini with no device/IP quota and could burn paid OCR. |
| **Fix Applied** | Same pattern as Career/Document: signed `gsm_device_id` + hashed IP, 2 free reads/month for non-Pro, release quota when upstream fails, `creditsCharged: 0` on failure. |
| **Verification Status** | FIXED & TESTED |

### 4. High — Excel formula errors / BOM not explicitly hardened

| Field | Value |
|---|---|
| **File Path** | `functions/_lib/currency.mjs`, `functions/_lib/adapters/baseAdapter.mjs` |
| **Line Number(s)** | currency.mjs `EXCEL_ERROR_RE` + `toMinorUnits` (≈L7–42); baseAdapter CSV BOM strip in `toWorkbook` |
| **Severity** | High |
| **Description** | `#REF!`, `#VALUE!`, `NaN` already fell through to 0 via regex failure, but were not named. CSV UTF-8 BOM could confuse header matching. |
| **Fix Applied** | Explicit Excel-error rejection in `toMinorUnits`; strip `\uFEFF` from amount strings and CSV text before SheetJS read. |
| **Verification Status** | FIXED & TESTED |

### 5. High — Bare `Address` column not in PII scrub list

| Field | Value |
|---|---|
| **File Path** | `functions/_lib/adapters/baseAdapter.mjs` |
| **Line Number(s)** | `PII_HEADERS` includes `'address'` |
| **Severity** | High |
| **Description** | Buyer/customer/shipping address aliases existed; a bare `Address` header could remain after scrub. |
| **Fix Applied** | Added `'address'` to `PII_HEADERS`. |
| **Verification Status** | FIXED & TESTED |

### 6. Medium — Owner screen a11y / safe errors

| Field | Value |
|---|---|
| **File Path** | `apps/hub/src/components/finance/OwnerVisualPWA.tsx`, `apps/hub/src/components/layout/SiteDoorBar.tsx` |
| **Line Number(s)** | Owner `aria-label` on upload/unlock/WhatsApp/copy/download; SiteDoorBar language/numeral toggles |
| **Severity** | Medium |
| **Description** | Icon-forward controls lacked `aria-label`. File parse errors could echo raw engine messages. |
| **Fix Applied** | Added `aria-label`s; sanitize catch messages (no stack / TypeError surfaces). Daylight Passbook theme, 48px+ targets, EN/हिंदी + 123/१२३ via SiteDoorBar already present. |
| **Verification Status** | FIXED & TESTED |

### 7. Medium — Confirm 95% OCR gate not lowered

| Field | Value |
|---|---|
| **File Path** | `apps/hub/src/lib/documents/browserOcrGate.ts` |
| **Line Number(s)** | L3 `DOCUMENT_CONFIDENCE_MIN = 95` |
| **Severity** | Medium (preventive) |
| **Description** | DeepSeek draft suggested &lt;85%. Live gate must stay ≥95.0% plus word/alignment checks. |
| **Fix Applied** | No change to threshold. Regression asserts `DOCUMENT_CONFIDENCE_MIN === 95` and rejects 94.9%. (`LOW_WORD_CONFIDENCE = 85` is only the per-word share filter inside the 95% mean gate — not a downgrade of the mean.) |
| **Verification Status** | FIXED & TESTED (locked) |

### 8. Medium / Low — Bundle note: `compromise`

| Field | Value |
|---|---|
| **File Path** | `apps/hub/src/lib/canvas/careerAtsMatch.ts`, `packages/shared/src/utils/atsAnalyzer.ts` |
| **Severity** | Low |
| **Description** | `compromise` (~345 KB) is dynamically imported for Career ATS. Still used — not dead weight. |
| **Fix Applied** | No removal. Documented as intentional Career NLP. |
| **Verification Status** | ACCEPTED (no code change) |

### 9. Low — Studio Pro ₹99 vs Mitra Pro ₹299 coexistence

| Field | Value |
|---|---|
| **File Path** | `packages/shared/src/lib/proBilling.mjs` (9900), `functions/_lib/unlockEngine.mjs` (`PRO_299` → 29900) |
| **Severity** | Low |
| **Description** | Audit confirmed billing is **not** stuck on 9900 only. Unlock checkout supports mandate ₹1, one-tap fee, and ₹299 Pro. |
| **Fix Applied** | None required. Covered by opus + phase5 tests. |
| **Verification Status** | VERIFIED |

---

## Pillars checked with no Critical/High defect

1. **Secrets** — No hardcoded Razorpay/Gemini/Azure secrets in `apps/` or `functions/` (public PostHog only where present). `/api/health` does not leak keys.
2. **SQLi** — Neon calls use tagged template / parameterized `sql` / `sql.query` with bound values (`guestAccess.mjs`, `headerMapper.mjs`, `neonSchema.mjs`).
3. **Money** — Audit path uses `toMinorUnits` / `applyBps`; TypeScript `number` for integer paise is correct. No `parseFloat(x) * 100` in audit money.
4. **Statutory taxes** — Phase2 proves Section 9(5), 194-O, Sec 52 TCS are not treated as overcharges; TOTAL rows dropped.
5. **End-to-end owner upload** — `auditUploadedWorkbook` → freemium mask → evidence pack already wired on file drop.
6. **Architecture** — No FastAPI recommendation introduced. Cloudflare Pages + `functions/_lib/` + Neon remains locked.

---

## Deliverables

| Artifact | Status |
|---|---|
| `AUDIT_REPORT_OPUS.md` | This file |
| Critical/High/Medium code fixes | Applied |
| `scripts/test-opus-audit.mjs` | Added & passing |
| Phase 1–8 regression | Passing |
| `npm run typecheck` / `npm run build` | Passing |
| `STATUS_REPORT.md` / `PWA_BLUEPRINT.md` | Updated |
