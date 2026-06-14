# GramSeva Mitra - Master App Architecture & Tech Stack Plan (Unified Canvas)

## 1. Project Objective
Transition GramSeva Mitra from a static "Tool Directory" into a modern, unified "App Model" SaaS platform. The goal is to maximize user retention and organic upsells to the ₹199/month Pro tier by seamlessly integrating free tools and premium serverless features within a persistent, high-performance UI shell.

**Status (Phases 1–8):** The App Shell and all five workspace MVPs are live. The platform is ready for the mass migration of remaining legacy tools into these canvases.

---

## 2. Core Technology Stack (Immutable)
* **Frontend Framework:** Astro (Static Site Generation) + React (interactive Canvas components) + Tailwind CSS (mobile-first).
* **Authentication:** Better Auth (Google OAuth).
* **Database:** Cloudflare D1 (SQLite at the Edge) — user identity and `plan` status.
* **Backend Compute:** Cloudflare Pages Functions (V8 Edge runtime, NOT Node.js).
* **Object Storage:** Cloudflare R2 (`PRO_TRANSIENT`) — ephemeral Pro uploads only; strict lifecycle deletion.
* **Payment Gateway:** Razorpay (Checkout.js on frontend, Web Crypto HMAC verification on backend).
* **Hosting:** Cloudflare Pages (deploy from repo root so `/functions` bindings apply).

### Client-Side Engines (Free Tier)
Loaded via **dynamic `import()`** only when a workspace or tool is opened:
* **PDF:** `pdfjs-dist` (text/render), `@cantoo/pdf-lib` via Web Worker (`pdfCanvas.worker.ts`).
* **Images:** `browser-image-compression`, Canvas `toBlob` for format conversion.
* **Career NLP:** `compromise` (ATS keyword matching).
* **Charts:** `chart.js` (Finance Hub visualizations).
* **Utilities:** `qrcode`, `passwordEngine`, `unitEngine`, and pure math engines under `apps/hub/src/lib/`.

---

## 3. App Shell Routing (Immutable — No Individual Tool Pages)

**Ground rule:** We no longer ship standalone `/tools/...` pages for end-user workflows. Every utility lives inside one of five workspace routes:

| Route | Workspace |
|-------|-----------|
| `/workspace/documents` | Document Studio |
| `/workspace/media` | Media Lab |
| `/workspace/career` | Career Prep |
| `/workspace/finance` | Finance Hub |
| `/workspace/quick-tools` | Quick Tools |

* **Persistent Shell:** Left sidebar (desktop) or hamburger menu (mobile) navigates between workspaces. Better Auth redirects authenticated users to `/workspace/documents` by default.
* **Legacy tool pages** may remain temporarily during migration but must not receive new features. All new work targets workspace canvases only.

---

## 4. The Two UI Patterns (Immutable)

All future tools MUST adopt one of these two patterns — never a third ad-hoc layout.

### Pattern A — Magic Dropzone → Active Canvas (File Workspaces)

**Used by:** Document Studio, Media Lab, Career Prep.

| Phase | UI |
|-------|-----|
| **Empty** | `MagicDropzone` — drag-and-drop (desktop) or tap-to-upload (mobile `< 768px`). File held in browser memory. |
| **Active** | File metadata card + **Contextual Action Toolbar** — actions filtered by MIME type. |
| **Processing** | `CanvasProcessingOverlay` + `CanvasToast` for long-running client or Pro jobs. |

**Shared implementation conventions:**
* `sessionStorage` keys: `gsm-canvas-documents`, `gsm-canvas-media`, `gsm-canvas-career` — metadata survives refresh; user re-uploads file bytes if needed.
* Action config: `*CanvasActions.ts` → `*ActionToolbar.tsx` → `use*ActionHandler.ts` → workspace `*Canvas.tsx`.
* Pro gating: `openProUpgrade()` from `@shared/lib/proUpgrade` before any paid pipeline runs.

### Pattern B — Grid Dashboard → Active Tool (Data-Entry Workspaces)

**Used by:** Finance Hub, Quick Tools.

| Phase | UI |
|-------|-----|
| **Default** | Categorized **Grid Dashboard** of tool cards (e.g., Investment, Loans, Taxes / Generators, Converters). |
| **Active** | Selected tool fills the canvas area with a **← Back to Tools** control to reset the view. |

**Shared implementation conventions:**
* `localStorage` keys per tool (e.g., `gsm-finance-sip`, `gsm-quick-tools-qr`) plus `gsm-finance-active` / `gsm-quick-tools-active` for view restoration.
* Tool registry: `*CanvasTools.ts` → `*ToolGrid.tsx` → `*HubCanvas.tsx` → individual tool components.
* No file dropzone — inputs are forms, sliders, and toggles only.

---

## 5. The 5 Core Workspaces (Consolidation — Tool Inventory)

All 83 legacy micro-tools will be absorbed into these 5 dynamic canvases:

1. **`/workspace/documents` (Document Studio):** File manipulation. (Merge, Split, Compress, Protect, Smart Extract).
2. **`/workspace/media` (Media Lab):** Image optimization. (Exam Photo Resizer, Format Conversion, AI Background Removal).
3. **`/workspace/career` (Career Prep):** Text & Layout parsing. (ATS Scanner, AI Resume Rewriter).
4. **`/workspace/finance` (Finance Hub):** Mathematical canvases. (EMI, GST, Invoice Builders).
5. **`/workspace/quick-tools` (Quick Tools):** Transient utilities. (Calculators, Generators).

---

## 6. Zero-Cost Free Tier — Client-Side First (Immutable)

**Ground rule:** All **Free** tools MUST execute **100% in the browser**. No free tool may upload files or raw document text to the server.

| Requirement | Implementation |
|-------------|----------------|
| **No server I/O** | Free actions use Web Workers, in-memory `File`/`ArrayBuffer`, or local React state only. |
| **No tracking uploads** | Free tier never calls `/api/*` for processing. |
| **Instant feedback** | Sub-second UI updates; debounce heavy work (e.g., QR render) locally. |
| **Privacy by default** | User data never leaves the device during free operations. |

When porting a legacy free tool, wire it into the correct workspace pattern (A or B) and reuse existing engines under `apps/hub/src/lib/` before adding dependencies.

---

## 7. Pro Serverless Pipeline (Immutable)

**Ground rule:** All **Pro** tools MUST gate free users through the monetization layer before any server work begins.

### Step 1 — Monetization Intercept
* Pro actions display a `⚡ Pro` badge on toolbars or grid cards.
* `use*ActionHandler` (or equivalent) checks Better Auth session → D1 `plan === 'pro'`.
* Free users: **`ProUpgradeModal`** (Razorpay) — no processing starts.
* Pro users: proceed to Step 2.

### Step 2 — Pro Execution (Two Approved Paths)

| Path | When to use | Flow |
|------|-------------|------|
| **A. Transient R2 + Edge Function** | Binary files (PDF, images) needing server-side AI/GPU | `POST /api/pro/*/upload` → R2 `PRO_TRANSIENT` → `POST /api/pro/*` → mock or real Workers AI → download/delete object. |
| **B. Local Text Extract + JSON Edge Function** | Resume/career text already extractable client-side | `pdfJsWorker` extracts text in browser → `POST /api/pro/career-ai` with `{ action, resumeText }` only — **no file upload**. |

**All `/api/pro/*` endpoints MUST:**
* Validate Pro status via `requireProUser()` (`functions/_lib/proGate.mjs`).
* Return structured JSON or binary with `Cache-Control: no-store`.
* Delete transient R2 objects after processing (best-effort).
* Be rate-limited at the Cloudflare edge (see §8).

---

## 8. Security, Performance & Loophole Mitigations (Must Implement)

1. **Mobile Interactions:** Drag-and-drop is unreliable on mobile. Dropzone workspaces MUST render a large **Tap to Upload** button on viewports `< 768px`.
2. **State Preservation:** File workspaces use `sessionStorage`; grid workspaces use `localStorage`. Refresh must restore the last view and form values where possible.
3. **Code Splitting (Dynamic Imports):** Heavy engines (`pdf.js`, `chart.js`, `compromise`, `qrcode`, `browser-image-compression`, `@cantoo/pdf-lib` worker) load only when the user opens the relevant workspace or tool.
4. **Transient Pro Storage:** R2 bucket `gramsevamitra-pro-transient` with strict lifecycle deletion (target: 1 hour). Keys scoped per user (`pro/{userId}/...`).
5. **GPU / AI Rate Limiting:** Cloudflare Rate Limiting on all `/api/pro/*` endpoints to prevent abuse of serverless tasks.

---

## 9. Execution Roadmap

### Completed (Phases 1–8) ✅
| Phase | Deliverable |
|-------|-------------|
| **1** | App Shell — sidebar, 5 workspace routes, auth redirect to `/workspace/documents` |
| **2** | Document Studio — Magic Dropzone, contextual toolbar, session restore |
| **3** | Monetization — `ProUpgradeModal`, D1 plan check, Razorpay wiring |
| **4** | Document Studio tools — Merge, Split, Compress, Protect, Unlock, Pro Smart Extract |
| **5** | Media Lab — dropzone MVP, Resize/Convert (free), Pro media pipeline (R2) |
| **6** | Career Prep — dropzone MVP, ATS + Cover Letter (free), Pro Career AI (JSON) |
| **7** | Finance Hub — grid dashboard, SIP / EMI / GST calculators + Chart.js |
| **8** | Quick Tools — grid dashboard, QR / Password / Unit Converter |

### Next — Phase 9+ (Mass Tool Migration)
Iteratively port remaining legacy tools from `toolsRegistry.ts` into the correct workspace and UI pattern (§4). Each migration PR must:
1. Target exactly one workspace.
2. Respect §6 (free = client-only) and §7 (Pro = gated pipeline).
3. Reuse existing canvas components, storage keys, and handler hooks.
4. Avoid new standalone routes.

---

## 10. Reference — Key File Map

| Concern | Location |
|---------|----------|
| Workspace routes | `apps/hub/src/pages/workspace/*.astro` |
| Dropzone canvases | `apps/hub/src/components/canvas/*Canvas.tsx` |
| Grid canvases | `FinanceHubCanvas.tsx`, `QuickToolsHubCanvas.tsx` |
| Action / tool config | `apps/hub/src/config/*CanvasActions.ts`, `*CanvasTools.ts` |
| Session / local storage | `apps/hub/src/lib/canvas/*CanvasStorage.ts` |
| Pro edge functions | `functions/api/pro/*.js` |
| Pro gate & R2 helpers | `functions/_lib/proGate.mjs`, `proTransientStorage.mjs`, `careerAiMock.mjs` |
| Client PDF worker | `apps/hub/src/workers/pdfCanvas.worker.ts` |
