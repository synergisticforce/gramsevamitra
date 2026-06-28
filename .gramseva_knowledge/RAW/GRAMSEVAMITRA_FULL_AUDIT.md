# GramSeva Mitra — Full Application Audit

**Generated:** 2026-06-18  
**Scope:** Production App Model (`/workspace/*`), all seven sidebar workspaces, client/server processing boundaries, To Editable Format heuristics, and orphaned legacy code.  
**Source of truth:** `apps/hub/src/config/appWorkspaces.ts`, workspace registries (`*CanvasActions.ts`, `*CanvasTools.ts`), canvas components, and `lib/services/toEditableFormatPipeline.ts`.

---

## 1. Executive Summary & Architecture

### 1.1 Product overview

GramSeva Mitra is a **mobile-first, client-first utility platform** aimed at rural and semi-urban users on 3G/4G networks. The production UI is organized into **seven workspace canvases** rendered inside a shared **App Shell** (`AppShellLayout.astro` → `AppSidebar.tsx`). Each workspace mounts a dedicated React canvas component. Legacy standalone `/tools/*` pages were removed; those routes 301-redirect to `/workspace/documents`.

**Total active tools in production UI: 95** (22 Document + 10 Image + 9 Video + 7 Career + 7 Lifestyle + 16 Finance + 24 Quick Tools).

### 1.2 Tech stack

| Layer | Technology |
|-------|------------|
| **Monorepo** | npm workspaces (`apps/hub`, `packages/shared`, `packages/auth`) |
| **Frontend framework** | Astro 4.x + React 18 (islands) |
| **Styling** | Tailwind CSS 3.x, mobile-first |
| **Hosting** | Cloudflare Pages + Workers (`wrangler.toml`) |
| **Auth** | Better Auth (Google OAuth, D1 SQLite binding) |
| **Payments** | Razorpay (Pro subscriptions + credit packs) |
| **Transient storage** | Cloudflare R2 (`PRO_TRANSIENT` bucket, 1-hour lifecycle) |
| **PDF (client)** | `@cantoo/pdf-lib`, `pdfjs-dist`, dedicated `pdfCanvas.worker.ts` |
| **PDF (server)** | `pdf-lib` / `pdfjs-dist` in `functions/_lib/chunkedDocumentProcessing.mjs` |
| **OCR (client)** | Tesseract.js v7 (`eng` + `hin`), `tesseractOcr.worker.ts` |
| **OCR (server Pro)** | Paddle → GLM → Google Vision waterfall (`ocrOrchestrator.mjs`) |
| **Video (client)** | FFmpeg WebAssembly (`@ffmpeg/ffmpeg` 0.12.x, core loaded from jsDelivr CDN) |
| **Image (client)** | HTML5 Canvas, `browser-image-compression` |
| **DOCX output (client)** | `docx` npm package (`textToDocxBlob` in `extractToWord.ts`) |
| **NLP (client)** | `compromise` (ATS Scanner keyword analysis) |
| **Charts** | Chart.js (finance/crypto/budget tools) |
| **PWA** | Vite PWA plugin + `workbox-window`; `PwaRegister.tsx` |
| **E2E tests** | Playwright |

**Design principle:** Zero-upload-by-default. Most tools run entirely in the browser. Server involvement is limited to Pro AI, large-file Smart Slicing, auth/billing, and transient R2 staging with automatic deletion.

### 1.3 Memory management & client-side processing strategies

#### Device-aware file limits

| Context | Mobile / tablet | Desktop |
|---------|-----------------|---------|
| **Local PDF processing** (before Smart Slicing) | 50 MB | 1 GB |
| **Max upload** | 1 GB | 2 GB |
| **Local video processing** (FFmpeg.wasm) | 250 MB | 2 GB |

Detection: `apps/hub/src/lib/pdf/deviceDetection.ts` (`isMobileOrTablet()` via UA + touch points).

#### PDF worker pipeline

- **Worker:** `apps/hub/src/workers/pdfCanvas.worker.ts`
- **Streaming:** Files streamed to worker in **2 MB chunks** (`pdfStreamTransfer.ts`); chunk arrays zeroed after assembly.
- **GC yielding:** `yieldToGc()` (`setTimeout(0)`) between pages/chunks in `pdfMemory.ts` and the worker.
- **Page-at-a-time compression:** JPEG pages processed individually during compress to cap RAM (`pdfWorkerClient.ts`).
- **pdf.js cleanup:** `page.cleanup()` after each render pass (`pdfRender.ts`).

#### Smart Slicing (large PDF fallback)

When `file.size > getLocalProcessingLimitBytes()`, modals call the **chunked server pipeline** (`/api/chunked/*`): 20 MB chunk upload → R2 assembly → server-side `pdf-lib` processing → download. Transient R2 objects deleted via `context.waitUntil`.

**Exceptions (no Smart Slicing — blocked if over limit):** Deskew/Straighten, PDF → JPG/PNG (require browser canvas rendering).

#### Tesseract.js worker flushing

Two patterns coexist:

| API | File | Behavior |
|-----|------|----------|
| `runTesseractWithMemoryFlush` | `tesseractWrapper.ts` | **Fresh worker per job**; `disposeTesseractWorker()` in `finally` — used by To Editable Format |
| `runTier1TesseractOcr` | `tesseractTier1.ts` | **Persistent** module-level worker — used by legacy modals |

Preprocessing: grayscale + binarize (`preprocessForOcr`), max image width **1600 px**, PDF sample **2 pages** at render scale **1.5×**, languages **eng + hin**.

#### FFmpeg WebAssembly (Video Studio)

- Lazy singleton load from jsDelivr (`@ffmpeg/core@0.12.6`) via `toBlobURL`.
- Virtual FS cleaned with `deleteFile()` after each job (`ffmpegClient.ts`).
- Blob URLs revoked after download (typically 5 s delay).
- Videos **never leave the browser**.

#### Canvas image filters

`filterImageInBrowser()` in `mediaImageTools.ts` — pure Canvas `getImageData`/`putImageData` for grayscale and black-and-white threshold. No server.

#### Pro upload RAM shield

PDFs **> 5 MB** for Pro pipelines: text extracted client-side first (`smartExtractPrep.ts`) so only extracted text (not raw file bytes) is sent where applicable.

#### On-device persistence

Workspace state (active file metadata, selected tool, job tracker boards, mood logs, etc.) stored in **localStorage** via per-workspace `*CanvasStorage.ts` modules. Mood/cycle data never syncs to server.

---

## 2. The 7 Workspaces (Detailed Breakdown)

Sidebar order is defined exclusively in `APP_WORKSPACES` (`apps/hub/src/config/appWorkspaces.ts`) and rendered verbatim by `AppSidebar.tsx`.

---

### 2.1 Document Studio

| Property | Value |
|----------|-------|
| **Route** | `/workspace/documents` |
| **Canvas** | `DocumentStudioCanvas.tsx` |
| **Registry** | `documentCanvasActions.ts` |
| **UI pattern** | **Pattern A — Dropzone First, Toolbar on Active File** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **`empty`** | Hero `MagicDropzone` only — no toolbar, no file card. |
| **`active`** | File metadata card (name, size, MIME) + Replace/Clear controls + `DocumentActionToolbar`. |
| **MIME filtering** | After upload, toolbar actions filter by file type (PDF vs image). Empty-catalog mode (`documentToolbarActions(false)`) shows all 22 actions when no `activeFile` object exists. |
| **To Editable Format** | Rendered as a dedicated panel above the action grid (`ToEditableFormatPanel.tsx`), not a modal. |
| **Modals** | Each PDF/image action opens a focused modal (split, merge, compress, etc.). |
| **Session restore** | File metadata persists across refresh via `documentCanvasStorage.ts`; user must re-upload binary to run actions. |
| **Omni handoff** | Homepage dropzone can pre-route intents into this workspace. |

#### Tools (22)

| # | Tool | Description | Processing |
|---|------|-------------|------------|
| 1 | **Split** | Split a PDF into separate files by page range. | Hybrid — client (`pdfCanvas.worker`); Smart Slicing server if > device limit |
| 2 | **Merge** | Combine multiple PDFs into one document with reorder support. | Hybrid — client default; Smart Slicing if any file > limit |
| 3 | **Compress** | Reduce PDF file size with quality presets. | Hybrid — client default; Smart Slicing if > limit |
| 4 | **Protect** | Add password protection to a PDF. | Hybrid — client default; Smart Slicing if > limit |
| 5 | **Unlock** | Remove password from a protected PDF. | Hybrid — client default; Smart Slicing if > limit |
| 6 | **Straighten (Deskew)** | Straighten skewed scanned PDF pages. | **Client-Side only** — blocked if file exceeds device limit (no server fallback) |
| 7 | **Remove Pages** | Delete selected pages from a PDF. | Hybrid — client default; Smart Slicing if > limit |
| 8 | **Page Numbers** | Stamp page numbers with position options. | Hybrid — client default; Smart Slicing if > limit |
| 9 | **Crop Page** | Crop PDF page margins interactively. | Hybrid — client default; Smart Slicing if > limit |
| 10 | **To PDF** | Convert JPG/PNG/WebP images into a PDF. | **Client-Side** (`pdfCanvas.worker`) |
| 11 | **To Editable Format** | Auto-orchestrated export to `.txt`, `.md`, `.docx`, `.xlsx`, `.csv`, or `.xml` with layout heuristics (see §3). | **Hybrid — Client → Pro Server** — free Paths A/B locally; Path C escalates to `/api/pro/reconstruct-layout` (2 credits) |
| 12 | **To JPG/PNG** | Export PDF pages to JPG or PNG images. | **Client-Side only** — blocked if file exceeds device limit |
| 13 | **Type & Save** | Create a new PDF by typing content (no upload required). | **Client-Side** |
| 14 | **Rotate** | Rotate PDF pages 90°/180°/270°. | Hybrid — client default; Smart Slicing if > limit |
| 15 | **Reorder** | Drag-and-drop reorder PDF pages. | Hybrid — client default; Smart Slicing if > limit |
| 16 | **Watermark** | Add text watermark overlay to PDF pages. | Hybrid — client default; Smart Slicing if > limit |
| 17 | **Organise** | Organise PDF pages (insert, duplicate, reorder workflow). | Hybrid — client default; Smart Slicing if > limit |
| 18 | **Repair PDF** | Attempt structural repair of corrupted PDFs. | Hybrid — client default; Smart Slicing if > limit |
| 19 | **Scanned PDF** | Build a searchable scanned PDF from photos. | **Client-Side** (image → PDF pipeline) |
| 20 | **Strip Metadata** | Remove embedded metadata from a PDF. | Hybrid — client default; Smart Slicing if > limit |
| 21 | **Sign PDF** | Draw or place a signature on PDF pages. | Hybrid — client default; Smart Slicing if > limit |
| 22 | **Redact** | Permanently redact sensitive regions on PDF pages. | Hybrid — client default; Smart Slicing if > limit |

---

### 2.2 Image Studio

| Property | Value |
|----------|-------|
| **Route** | `/workspace/image` (legacy `/workspace/media` → 301 redirect) |
| **Canvas** | `MediaLabCanvas.tsx` |
| **Registry** | `mediaCanvasActions.ts` |
| **UI pattern** | **Pattern A — Dropzone First, Toolbar on Active Image** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **`empty`** | `MediaMagicDropzone` hero — accepts JPG, PNG, WebP only. |
| **`active`** | Image file card + `MediaActionToolbar` filtered by image MIME. |
| **Pro tools** | Background removal, 4× upscale, AI restore trigger Pro credit confirm then upload to `/api/pro/media-process`. |
| **Modals** | Free tools open dedicated modals (resize, crop, filters, etc.). |

#### Tools (10)

| # | Tool | Description | Processing |
|---|------|-------------|------------|
| 1 | **Exam Photo** | Optimize ID/exam photos (deskew, B&W, crop presets). | **Client-Side** (Canvas) |
| 2 | **Resize & Compress** | Resize dimensions and compress file size. | **Client-Side** (Canvas + `browser-image-compression`) |
| 3 | **Convert Format** | Convert between JPG, PNG, and WebP. | **Client-Side** (Canvas) |
| 4 | **Crop Image** | Interactive crop with aspect-ratio presets. | **Client-Side** (Canvas) |
| 5 | **Watermark** | Overlay text watermark on images. | **Client-Side** (Canvas) |
| 6 | **Image to PDF** | Wrap image(s) into a PDF document. | **Client-Side** (`pdfCanvas.worker`) |
| 7 | **Filters** | Apply grayscale or black-and-white filters. | **Client-Side** (Canvas pixel ops) |
| 8 | **Remove Background** ⚡ Pro | AI background removal for exam/ID photos. | **Pro Server** (`/api/pro/media-process`) |
| 9 | **Upscale 4×** ⚡ Pro | AI super-resolution up to 4×. | **Pro Server** (`/api/pro/media-process`) |
| 10 | **AI Restore** ⚡ Pro | Colorize and repair old or damaged photos. | **Pro Server** (`/api/pro/media-process`) |

---

### 2.3 Video Studio

| Property | Value |
|----------|-------|
| **Route** | `/workspace/video` |
| **Canvas** | `VideoHubCanvas.tsx` |
| **Registry** | `videoCanvasTools.ts` |
| **UI pattern** | **Pattern B — Dropzone First, Grid Visible Alongside Active File** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **`empty`** | Hero `VideoDropzone` — no tool grid until a video is loaded. |
| **`active`** | Compact re-upload strip + file info + **`VideoToolGrid` always visible** + selected tool panel below. |
| **Processing overlay** | Full-screen progress overlay during FFmpeg.wasm jobs. |
| **Memory guard** | Files exceeding 250 MB (mobile) / 2 GB (desktop) rejected before processing. |

#### Tools (9)

| # | Tool | Description | Processing |
|---|------|-------------|------------|
| 1 | **MP4 to MP3** | Strip and export the audio track as MP3. | **Client-Side** (FFmpeg.wasm) |
| 2 | **Video Compressor** | Reduce to 720p or 480p H.264. | **Client-Side** (FFmpeg.wasm) |
| 3 | **Format Converter** | Convert between MP4, WebM, and MOV. | **Client-Side** (FFmpeg.wasm) |
| 4 | **Mute Video** | Remove audio track, keep video stream. | **Client-Side** (FFmpeg.wasm) |
| 5 | **Video to GIF** | Trim a segment and export animated GIF. | **Client-Side** (FFmpeg.wasm) |
| 6 | **Trim Video** | Cut clip by start/end timestamps. | **Client-Side** (FFmpeg.wasm) |
| 7 | **Add Watermark** | Overlay text watermark on video. | **Client-Side** (FFmpeg.wasm) |
| 8 | **Change Speed** | Slow to 0.5× or speed up to 1.5×/2×. | **Client-Side** (FFmpeg.wasm) |
| 9 | **Extract Frame** | Scrub to any second and export JPG still. | **Client-Side** (HTML5 `<video>` + Canvas — not FFmpeg) |

---

### 2.4 Career Prep

| Property | Value |
|----------|-------|
| **Route** | `/workspace/career` |
| **Canvas** | `CareerPrepCanvas.tsx` |
| **Registry** | `careerCanvasActions.ts` |
| **UI pattern** | **Pattern A — Dropzone First, Toolbar Hidden Until Document Loaded** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **`empty`** | `CareerMagicDropzone` only — accepts PDF and DOCX. **No toolbar.** |
| **`active`** | Document file card + `CareerActionToolbar`. |
| **Toolbar gating** | `careerToolbarActions()` returns **empty array** unless `activeFile.file` exists — even standalone tools (Legal Docs, Skill Gap, Biz Card) require a file upload first (UX quirk / tech debt). |
| **Document-linked tools** | ATS Scanner, Cover Letter Templates, AI Resume Rewriter, AI Cover Letter require PDF/DOCX on canvas. |
| **Pro AI** | Resume rewriter and cover letter generator upload extracted text to `/api/pro/career-ai` (not raw file). |

#### Tools (7)

| # | Tool | Description | Processing |
|---|------|-------------|------------|
| 1 | **Legal Docs** | Generate employment/legal document templates locally. | **Client-Side** (template engine + localStorage) |
| 2 | **Skill Gap** | Compare skills against a target role with gap analysis. | **Client-Side** |
| 3 | **Biz Card** | Design and export a business card. | **Client-Side** (Canvas/PDF export) |
| 4 | **ATS Scanner** | Score resume against ATS keyword rules (PDF only at runtime). | **Client-Side** (`pdf.js` text extraction + `compromise` NLP) |
| 5 | **Cover Letter Templates** | Fill cover letter templates from uploaded resume context. | **Client-Side** |
| 6 | **AI Resume Rewriter** ⚡ Pro | Rewrite resume for a specific job description. | **Pro Server** (`/api/pro/career-ai`) — PDF only |
| 7 | **AI Cover Letter** ⚡ Pro | Generate tailored cover letter from resume + job posting. | **Pro Server** (`/api/pro/career-ai`) — PDF only |

**Note:** Job Tracker, Cold Email Builder, Salary Calculator, and Salary Benchmarking were **migrated out** of Career Prep to Quick Tools and Finance Hub respectively.

---

### 2.5 Health & Lifestyle

| Property | Value |
|----------|-------|
| **Route** | `/workspace/lifestyle` |
| **Canvas** | `LifestyleHubCanvas.tsx` |
| **Registry** | `lifestyleCanvasTools.ts` |
| **UI pattern** | **Pattern B — Grid First, No Dropzone** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **Default (`grid`)** | Category-grouped `LifestyleToolGrid` — all 7 tools visible immediately. |
| **Tool selected** | "Back to Tools" button + tool header + inline panel. |
| **Persistence** | Mood log and cycle data saved to localStorage only. |

#### Tools (7)

| # | Tool | Category | Description | Processing |
|---|------|----------|-------------|------------|
| 1 | **BMI Calculator** | Body | Metric/imperial BMI with WHO range indicators. | **Client-Side** |
| 2 | **Body Fat Calculator** | Body | US Navy tape-measure body fat estimate. | **Client-Side** |
| 3 | **Macro & Calorie Calculator** | Nutrition | TDEE and macro splits for cut/maintain/bulk. | **Client-Side** |
| 4 | **Age & Date Calculator** | Dates | Exact age or duration between two dates. | **Client-Side** |
| 5 | **Exam Age Eligibility** | Dates | Check DOB against government exam age windows. | **Client-Side** |
| 6 | **Menstrual & Ovulation** | Wellness | Predict period, ovulation, and fertile window. | **Client-Side** (localStorage) |
| 7 | **Mood & Daily Log** | Wellness | Private emoji + text journal on-device. | **Client-Side** (localStorage) |

---

### 2.6 Finance Hub

| Property | Value |
|----------|-------|
| **Route** | `/workspace/finance` |
| **Canvas** | `FinanceHubCanvas.tsx` |
| **Registry** | `financeCanvasTools.ts` |
| **UI pattern** | **Pattern B — Grid First, No Dropzone** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **Default (`grid`)** | Category-grouped `FinanceToolGrid` (Investment, Loans, Taxes, Business, Everyday, International, Planning). |
| **Tool selected** | "Back to Tools" + tool panel with live calculators/forms. |
| **PDF exports** | Invoice Builder and Pay Stub Generator render PDF client-side. |

#### Tools (16)

| # | Tool | Category | Description | Processing |
|---|------|----------|-------------|------------|
| 1 | **SIP Calculator** | Investment | Project SIP maturity, invested amount, and gains. | **Client-Side** |
| 2 | **Crypto Gains** | Investment | FIFO capital gains tracking with portfolio charts. | **Client-Side** |
| 3 | **EMI Calculator** | Loans | Monthly EMI with principal vs. interest breakdown. | **Client-Side** |
| 4 | **Loan Repayment** | Loans | Prepayment planning with amortization over time. | **Client-Side** |
| 5 | **GST Calculator** | Taxes | Add/remove GST with CGST, SGST, IGST splits. | **Client-Side** |
| 6 | **Tax Deductions** | Taxes | Estimate savings from 80C, 80D, HRA, etc. | **Client-Side** |
| 7 | **Discount & Margin** | Business | Sale discounts, tax, margin %, and markup. | **Client-Side** |
| 8 | **Meeting Cost** | Business | Rupee cost of meetings by hourly attendee rates. | **Client-Side** |
| 9 | **Invoice Builder** | Business | Build invoices with live preview and PDF export. | **Client-Side** (PDF generation in browser) |
| 10 | **Pay Stub Generator** | Business | Generate pay stubs with earnings/deductions PDF. | **Client-Side** (PDF generation in browser) |
| 11 | **Tip & Split** | Everyday | Split restaurant bills with adjustable tip %. | **Client-Side** |
| 12 | **Currency Converter** | International | Convert 160+ currencies with live rates. | **Hybrid — Client + External API** (Frankfurter API fetch, 12 h local cache) |
| 13 | **Envelope Budget** | Planning | Zero-based envelope budgeting with charts. | **Client-Side** (localStorage) |
| 14 | **Gig Income Tracker** | Planning | Log freelance income with monthly breakdowns. | **Client-Side** (localStorage) |
| 15 | **Salary Calculator** | Planning | Estimate in-hand pay from CTC with EPF/tax. | **Client-Side** |
| 16 | **Salary Benchmarking** | Planning | Compare role against regional India salary data. | **Client-Side** (bundled static JSON benchmarks) |

---

### 2.7 Quick Tools

| Property | Value |
|----------|-------|
| **Route** | `/workspace/quick-tools` |
| **Canvas** | `QuickToolsHubCanvas.tsx` |
| **Registry** | `quickToolsCanvasTools.ts` |
| **UI pattern** | **Pattern B — Grid First, No Dropzone** |

#### UX state machine

| Phase | What the user sees |
|-------|-------------------|
| **Default (`grid`)** | Category-grouped `QuickToolsToolGrid` (9 categories, 24 tools). |
| **Tool selected** | "Back to Tools" + inline tool component. |
| **Persistence** | Last-selected tool restored from `quickToolsCanvasStorage.ts` on reload. |

#### Tools (24)

| # | Tool | Category | Description | Processing |
|---|------|----------|-------------|------------|
| 1 | **QR Code Generator** | Generators | Encode URL/text to scannable QR with PNG download. | **Client-Side** |
| 2 | **Password Generator** | Generators | Cryptographically random passwords with custom rules. | **Client-Side** (`crypto.getRandomValues`) |
| 3 | **Random Number Generator** | Generators | Bulk random integers in a range, optional unique values. | **Client-Side** |
| 4 | **Unit Converter** | Converters | 40+ units across length, weight, temperature, area, volume, speed, time. | **Client-Side** |
| 5 | **Format Converter** | Converters | Convert and validate JSON, CSV, and XML. | **Client-Side** |
| 6 | **Percentage Calculator** | Math | X% of Y, comparisons, percent change. | **Client-Side** |
| 7 | **Scientific Calculator** | Math | Trig, powers, expression history with keypad. | **Client-Side** |
| 8 | **Base64 Encoder** | Developer | Encode/decode UTF-8 ↔ Base64. | **Client-Side** |
| 9 | **URL Encoder** | Developer | Encode/decode URI components. | **Client-Side** |
| 10 | **Hash Generator** | Developer | MD5 and SHA-256 digests as you type. | **Client-Side** (Web Crypto API) |
| 11 | **Color Palette** | Design | Complementary, analogous, triadic swatches from base hex. | **Client-Side** (Canvas) |
| 12 | **Decision Wheel** | Lifestyle | Spin canvas wheel to pick from custom options. | **Client-Side** (Canvas) |
| 13 | **Typing Speed Test** | Productivity | Real-time WPM and accuracy with practice text. | **Client-Side** |
| 14 | **Pomodoro Focus Timer** | Productivity | Customizable focus/break cycles with audio alerts. | **Client-Side** |
| 15 | **Event Countdown** | Productivity | Live D:H:M:S countdown to exams or deadlines. | **Client-Side** |
| 16 | **SEO Meta Tags** | Web | Preview Google snippets and copy meta tags. | **Client-Side** |
| 17 | **Recipe Scaler** | Lifestyle | Scale ingredient lists with serving-size slider. | **Client-Side** |
| 18 | **Baby Name Generator** | Lifestyle | Browse Indian and international baby names offline. | **Client-Side** (bundled name dataset) |
| 19 | **Pet Care Scheduler** | Lifestyle | Track feeding, walks, and grooming tasks. | **Client-Side** (localStorage) |
| 20 | **Garden Planner** | Lifestyle | Log sow dates, watering, and planting notes. | **Client-Side** (localStorage) |
| 21 | **Construction Estimator** | Home & DIY | Estimate cement, bricks, labor, and material costs. | **Client-Side** |
| 22 | **Renovation Budget** | Home & DIY | Room-by-room renovation line items and breakdowns. | **Client-Side** |
| 23 | **Job Tracker** | Productivity | Kanban board for job applications across pipeline stages. | **Client-Side** (localStorage) |
| 24 | **Cold Email Builder** | Productivity | Outreach, follow-up, and thank-you email templates. | **Client-Side** |

---

## 3. The "To Editable Format" Heuristics Engine

The unified **To Editable Format** pipeline (`runToEditableFormatPipeline` in `apps/hub/src/lib/services/toEditableFormatPipeline.ts`) replaced legacy standalone tools: Extract Text, Extract to Word, Smart Extract (toolbar), and Hi-Fi Convert (toolbar). It is surfaced via `ToEditableFormatPanel.tsx` inside Document Studio's toolbar.

### 3.1 Architecture overview

```
Upload PDF/Image
       │
       ▼
 analyzeDocumentLayout()          ← 300 ms budget (layoutAnalyzer.ts)
       │
       ├── Target = xlsx | csv | xml ──────────────────► PATH C (Pro) — always
       │
       ├── Target = txt | md ───────────────────────────► PATH A or B — never Pro
       │                                                    (extractRawTextLocally)
       │
       ├── NATIVE PDF + complexLayout + target = docx ──► PATH C (Pro)
       │
       ├── NATIVE PDF + simple layout + embedded text ──► PATH A (free)
       │                                                    extractPdfTextInBrowser → .docx
       │
       └── SCANNED / thin text layer ────────────────────► Tesseract (eng+hin, 2 pages)
                │                                              │
                ├── confidence ≥ 65% AND not gibberish ──► PATH B (free) → .docx
                │
                └── needsProHandoff ─────────────────────► PATH C (Pro)
                                                              /api/pro/reconstruct-layout
                                                              (2 credits)
```

### 3.2 Layout analysis (`layoutAnalyzer.ts`)

| Constant / rule | Value | Effect |
|-----------------|-------|--------|
| `ANALYSIS_BUDGET_MS` | **300 ms** | Layout analysis races against timeout; on timeout, conservative fallback profile |
| `SAMPLE_PAGE_LIMIT` | **2 pages** | Native text sampled from first 2 pages via pdf.js |
| **NATIVE profile** | `hasNativeTextLayer && sampleText.trim().length > 40` | PDF dictionary scan (first 512 KB) detects fonts + BT/Tj text operators |
| **`detectComplexLayout` — delimiter hits** | **≥ 8** matches of `\|`, `\t`, or 3+ spaces | Triggers complex layout flag |
| **`detectComplexLayout` — line variance** | `stdDev/avg > 0.55` (requires ≥ 4 lines) | Triggers complex layout flag |
| **`isLargeScannedDocument`** | `pageCount > 5` OR `file.size > 10 MB` | UX notice only — processing remains free locally |
| **Images** | Always `SCANNED`, `complexLayout: false` | Routed to Tesseract Path B |

### 3.3 Embedded PDF text thin-layer detection (`documentPdfTools.ts`)

| Constant | Value |
|----------|-------|
| `MIN_EMBEDDED_TEXT_CHARS` | **200** |
| Thin-layer trigger | Stripped text < 200 chars **AND** (≥ 50% pages "no text detected" **OR** stripped < 50 chars) |

When thin, native Path A is skipped → Tesseract OCR Path B.

### 3.4 OCR confidence & gibberish detection (`ocrQuality.ts`)

| Constant | Value | Scope |
|----------|-------|-------|
| `OCR_TIER1_CONFIDENCE_MIN` | **65%** | Average word confidence below this → Pro handoff |
| `OCR_TIER1_MAX_SAMPLE_PAGES` | **2** | Pages OCR'd locally |
| `OCR_PADDLE_WORD_CONFIDENCE_MIN` | **80%** | Server smart-extract waterfall only (separate from To Editable Format) |

**`tier1NeedsProHandoff(text, confidence)` returns true if:**
1. Average word confidence **< 65%**, OR
2. `isOcrGibberish(text)` returns true

**Gibberish heuristics (`isOcrGibberish`):**
- Empty after trim
- 6+ repeated identical characters
- Zero alphanumeric characters
- Length > 12 and symbol ratio > **62%**
- 2+ box-drawing chars (`□▯■`)
- ≥ 4 tokens with > **55%** single-character non-digit tokens

### 3.5 Path definitions

| Path | Name | Trigger | Output | Cost |
|------|------|---------|--------|------|
| **A** | Native text extraction | NATIVE PDF, simple layout, non-thin embedded text | `.docx` (or `.txt`/`.md` for raw formats) | Free |
| **B** | Local OCR | Scanned/thin/image files passing confidence + gibberish checks | `.docx` | Free |
| **C** | Pro layout reconstruction | Structural formats, complex native layout, or OCR handoff | `.docx`, `.xlsx`, `.csv`, `.xml` | Pro — **2 credits** via `/api/pro/reconstruct-layout` |

### 3.6 Format-specific routing rules

| Target format | Local allowed? | Pro required when |
|---------------|----------------|-------------------|
| `.txt`, `.md` | **Always local** (Paths A/B) — never escalates to Pro for layout | Never |
| `.docx` | Local Paths A/B when heuristics pass | NATIVE + complexLayout, OR OCR handoff |
| `.xlsx`, `.csv`, `.xml` | **Never local** | Always Path C — immediate paywall if not Pro |

### 3.7 Paywall triggers (UI layer — `ToEditableFormatPanel.tsx`)

1. User selects `.xlsx`/`.csv`/`.xml` without Pro → `promptProUpgradeForComplexLayout()` immediately.
2. Pipeline throws `EditableFormatProRequiredError` with `autoPromptPro: true` → upgrade modal.
3. Pro user hitting Path C → `requestProConfirm('reconstruct-layout', ...)` before upload.
4. Large scan notice → optional "Speed up with Pro" link (still free if user waits).
5. Pro API uploads to transient R2 → processes on Worker → returns base64 download → R2 object deleted.

### 3.8 Tesseract preprocessing (Path B)

- PDF: first **2 pages**, render scale **1.5×**, preprocess `{ contrast: 1.8, binarize: true }`
- Images: max width **1600 px**, same preprocess
- Worker: **fresh spawn + terminate per job** (`runTesseractWithMemoryFlush`) to flush WASM RAM
- Languages: **English + Hindi** (`eng+hin`)

### 3.9 Legacy OCR waterfall (separate system)

The **smart-extract** Pro API (`/api/pro/smart-extract` + `ocrWaterfallPipeline.ts`) uses a **different** server waterfall (Tier 1 Tesseract → Paddle → GLM → Google Vision) with an **80%** Paddle confidence threshold. This pipeline is **not** invoked by To Editable Format Path C. Legacy omni intents `smart-extract` and `extract-text` now route to `to-editable-format` via `omniDispatch.ts`.

---

## 4. Technical Debt & Orphaned Files

### 4.1 Removed route system

| Item | Status |
|------|--------|
| `apps/hub/src/pages/tools/` | **Does not exist** — all `/tools/*` URLs 301 → `/workspace/documents` (`public/_redirects`) |
| `toolsRegistry.ts` | **Zero imports** in production hub code — migration catalog only |
| `scripts/scaffold-tools-routes.mjs` | Scaffolds deleted `/tools/*` pages — stale |
| `scripts/fix-utilities-hrefs.mjs` | Rewrites hrefs for removed `/tools` paths — stale |

### 4.2 Orphaned canvas modals (exist on disk, not imported)

| File | Was replaced by |
|------|-----------------|
| `ExtractToWordModal.tsx` | `ToEditableFormatPanel.tsx` + `toEditableFormatPipeline.ts` |
| `PdfToTextModal.tsx` | `ToEditableFormatPanel.tsx` (`.txt`/`.md` export) |
| `HiFiConverterModal.tsx` | Removed from Document Studio toolbar (Hi-Fi PDF→DOCX/PPTX no longer in active UI) |
| `SalaryCalculatorModal.tsx` | `FinanceSalaryCalculator.tsx` in Finance Hub |
| `SalaryBenchmarkModal.tsx` | `FinanceSalaryBenchmark.tsx` in Finance Hub |

### 4.3 Orphaned lib modules (only referenced by dead modals)

| File | Evidence |
|------|----------|
| `lib/canvas/documentFileConverter.ts` | Imported only by `HiFiConverterModal.tsx` |
| `lib/canvas/documentSmartExtract.ts` | `runSmartExtractPipeline` — **zero imports** repo-wide |
| `promptProUpgradeForExtractToWord()` in `ocrWaterfallPipeline.ts` | Only caller is orphaned `ExtractToWordModal.tsx` |

### 4.4 Orphaned `components/tools/*` (32 of 33 files)

Only **`PwaRegister.tsx`** is live (imported by `AppShellLayout.astro`). All others were built for deleted `/tools/*` Astro pages and have **no importers**:

`AgeCalculatorTool.tsx`, `BabyNameFinderTool.tsx`, `Base64Tool.tsx`, `CaseConverterTool.tsx`, `ColorPaletteTool.tsx`, `CoverLetterGenerator.tsx`, `DecisionWheelTool.tsx`, `DocumentRedactor.tsx`, `DraftSavedBadge.astro`, `EmiCalculatorTool.tsx`, `ExamPhotoStudio.tsx`, `FlashcardGeneratorTool.tsx`, `FormatConverterTool.tsx`, `GstCalculatorTool.tsx`, `HashGeneratorTool.tsx`, `JobTrackerTool.tsx`, `MacroCalculatorTool.tsx`, `MarginCalculatorTool.tsx`, `MultiCurrencyConverterTool.tsx`, `OcrExtractor.tsx`, `PasswordGeneratorTool.tsx`, `PercentageCalculatorTool.tsx`, `QrGeneratorTool.tsx`, `RecipeScalerTool.tsx`, `SalaryBenchmarker.tsx`, `ScientificCalculatorTool.tsx`, `SeoMetaGeneratorTool.tsx`, `SipCalculatorTool.tsx`, `TypingSpeedTestTool.tsx`, `TypingTestTool.tsx`, `UnitConverterTool.tsx`, `WordCounterTool.tsx`

**Active replacements** live under `components/canvas/Quick*`, `Finance*`, `Lifestyle*`, etc.

### 4.5 Unmigrated legacy workspace: Smart Writing Studio

The entire **`writing`** workspace in `toolsRegistry.ts` (~13 tools at `/tools/writing/*`) has **no `/workspace/writing` route**. These tools were partially absorbed into Document Studio and Quick Tools but several remain unmigrated, including:

- Plagiarism Checker, Readability Analyzer, Word Counter, Case Converter
- Speech-to-Text, Text-to-Speech
- Flashcard Generator
- Legacy OCR Extractor (TrOCR/ONNX — `OcrExtractor.tsx` orphaned)

### 4.6 Unmigrated legacy workspace: Life & Focus Tracker

The **`life`** workspace tools from `toolsRegistry.ts` were partially migrated to **Health & Lifestyle** (BMI, macros, mood, menstrual) but legacy entries for Pomodoro, Event Countdown, and Typing Speed Test now live in **Quick Tools** instead. The old `components/tools/*` copies remain orphaned.

### 4.7 UX / logic debt (not orphaned files, but cleanup candidates)

| Issue | Location | Detail |
|-------|----------|--------|
| Career standalone tools gated behind file upload | `careerCanvasActions.ts` → `careerToolbarActions()` | Legal Docs, Skill Gap, Biz Card have no `requiresDocument` flag but toolbar returns `[]` when no file loaded |
| Dual Tesseract worker strategies | `tesseractWrapper.ts` vs `tesseractTier1.ts` | Inconsistent memory flush behavior between pipelines |
| `validate-tools-registry.mjs` | `scripts/` | Validates 5 routes — missing `video` and `lifestyle` workspace pages |
| `generate-audit.js` | `scripts/` | Previous audit script targeted old 5-workspace model |
| Legacy `/workspace/media` | `media.astro` | 301 redirect exists — correct, but docs may still say "Media Lab" |

### 4.8 Safe deletion candidates (highest confidence)

**Can archive/delete after verification:**

1. Five orphaned canvas modals (§4.2)
2. Thirty-two orphaned `components/tools/*` files except `PwaRegister.tsx`
3. `toolsRegistry.ts` (after confirming no external package dependency)
4. `documentFileConverter.ts`, `documentSmartExtract.ts`
5. `scripts/scaffold-tools-routes.mjs`, `scripts/fix-utilities-hrefs.mjs`
6. `promptProUpgradeForExtractToWord()` export (if `ExtractToWordModal` removed)

**Must keep:**

- `extractToWord.ts` — `textToDocxBlob()` used by `toEditableFormatPipeline.ts`
- All modals imported by `DocumentStudioCanvas.tsx`, `MediaLabCanvas.tsx`, `CareerPrepCanvas.tsx`
- All `Quick*`, `Finance*`, `Lifestyle*`, `Video*` canvas components wired through workspace pages
- `ocrWaterfallPipeline.ts` — may still be referenced by Pro smart-extract API routes

---

## Appendix A — Tool count summary

| # | Workspace | Tools | Pro tools | UI pattern |
|---|-----------|-------|-----------|------------|
| 1 | Document Studio | 22 | 0 (To Editable Format escalates to Pro dynamically) | Dropzone → Toolbar |
| 2 | Image Studio | 10 | 3 | Dropzone → Toolbar |
| 3 | Video Studio | 9 | 0 | Dropzone → Grid + Panel |
| 4 | Career Prep | 7 | 2 | Dropzone → Toolbar |
| 5 | Health & Lifestyle | 7 | 0 | Grid → Panel |
| 6 | Finance Hub | 16 | 0 | Grid → Panel |
| 7 | Quick Tools | 24 | 0 | Grid → Panel |
| | **Total** | **95** | **5 explicit Pro toolbar actions** | |

## Appendix B — Server API routes reference

| Route | Purpose |
|-------|---------|
| `auth/[[path]].js` | Better Auth sessions |
| `user/credits.js` | Pro credit balance |
| `billing/razorpay-order.js` / `razorpay-webhook.js` | Payments |
| `contact.js` | Contact form |
| `chunked/session.js`, `chunked/finalize.js` | Large-file upload assembly |
| `chunked/document/*.js` | Smart Slicing PDF ops |
| `pro/reconstruct-layout/*` | To Editable Format Path C |
| `pro/media-process/*` | Image Pro AI |
| `pro/file-converter/*` | Hi-Fi convert (orphaned UI) |
| `pro/smart-extract/*`, `pro/ocr-orchestrator.js` | Legacy Pro OCR waterfall |
| `pro/career-ai.js` | AI resume / cover letter |
| `pro/smart-router.js`, `pro/extract.js` | Structured document routing |

---

*End of audit. For interactive re-generation of tool wiring counts, run `node scripts/generate-audit.js` (generates `Audit_Report.docx`).*
