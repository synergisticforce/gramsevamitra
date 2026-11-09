# GramsevaMitra — Current State Blueprint

Audit date: 10 October 2026  
Read this as a status report, not a sales pitch.  
The live website and this folder were last changed on 5 August 2026. Nothing in the product code has moved since then.

---

## 1. EXECUTIVE SUMMARY

GramsevaMitra is a phone-first toolkit for Indian paperwork and everyday jobs. A person can scan a document, tidy a PDF, resize an exam photo, trim a short video, and use calculators for EMI, GST, and similar tasks. Most of that work happens on the phone itself, so a weak network does not stop the free tools. A paid “Pro” plan (₹99 per year in the code) is meant to unlock heavier AI help such as reading a scanned page into editable text.

As a free everyday toolkit, the project is roughly **70% complete** and already live. As a paid product that a stranger can trust with money, it is closer to **50% complete**. The free document, photo, video, money, and quick-tool studios are real. Two AI document tools that call Google Gemini are also real. Several older “Pro” paths still return made-up results, and one of them — AI Resume Rewriter and AI Cover Letter — still charges AI Credits for that fake text.

**The single most important thing to know right now:** the website is live at [https://gramsevamitra.com](https://gramsevamitra.com), the Android debug build is green, and the project has been sitting still for about nine weeks. Do not add a new feature until the fake paid Career AI button is switched off or replaced with a real one. Charging people for placeholder text is the fastest way to lose trust.

---

## 2. DEPLOYMENT & LIVE STATUS

| Question | Answer |
|---|---|
| Is it deployed? | Yes. The website is hosted on **Cloudflare Pages**, project name `gramsevamitra-hub`. |
| Live URL | [https://gramsevamitra.com](https://gramsevamitra.com) |
| What the home page does | It immediately opens Document Studio at `/workspace/documents`. Checked live on 10 October 2026. The server answered and redirected there. |
| Domain connected? | Yes. `gramsevamitra.com` responds. `www.gramsevamitra.com` also opens the same app. `utilities.gramsevamitra.com` opens the same app too. |
| HTTPS | Yes. The live response includes a strict HTTPS rule (`strict-transport-security`). |
| Staging environment | There is no separate public staging website in this repo. GitHub can build a preview when someone opens a pull request. That is not a standing test site with its own address. |
| Last deployment | GitHub’s “Build & Deploy” workflow succeeded on **5 August 2026, about 1:15 AM India time**, from commit `3202a63` on `main`. |
| Android app build | The “Build Debug APK” workflow failed once on 4 August because the build machine was still on Node.js 20. That was fixed. The same workflow then **succeeded twice on 5 August** (last success about 8:38 AM India time). That produces a test APK, not a Play Store release. |
| Play Store | This folder cannot prove the app is listed on the Play Store. A release signing setup exists, but the signing key is correctly kept out of GitHub. Treat store listing as unknown until you check the Play Console yourself. |
| Other old sites | An older checklist still mentions separate sites for PDF, image optimizer, and resume (`pdf.gramsevamitra.com` and similar). Those apps are **gone from this repository**. Only the one hub app remains. |

The cloud helpers (login, payments, AI) live in the `functions/` folder and deploy with the same Cloudflare Pages project. They are not a separate server you rent by the month.

---

## 3. CORE TECH STACK

| Piece | What it actually is |
|---|---|
| Framework | **Astro 4** for the pages, with **React 18** for the interactive studios. This is not Next.js and not Vite-as-the-app. Vite runs underneath Astro when it builds. |
| Language | **TypeScript** in the website, plain JavaScript in most cloud functions. |
| Styling | **Tailwind CSS**. One shared config: `packages/shared/tailwind.config.mjs`. |
| State | No Redux and no Zustand. Each screen keeps its own React state. Files the user is working on are remembered in the browser (`localStorage` / IndexedDB) and, on the Android app, in the phone’s file storage. |
| Routing | Astro pages. There is no React Router. The real screens are under `/workspace/...`. |
| Build tool | Astro’s build (`astro build`), which uses Vite. |
| Package manager | **npm**. The lockfile is `package-lock.json`. There is no pnpm or yarn lockfile. |
| Node.js required | **22 or newer.** `.nvmrc` says `22`. The root `package.json` says `>=22.0.0`. This exists because the Android tooling (Capacitor 8.5) refuses to run on Node 20. |
| Phone shell | **Capacitor 8**, Android-first. An iOS project folder also exists. |
| Where the app code lives | `apps/hub` is the only app. Shared pieces are in `packages/shared` and `packages/auth`. |

There is no `vite.config.ts`. Build settings are in `apps/hub/astro.config.mjs`.

---

## 4. FEATURE-TO-TOOL MAPPING

Statuses used below:

- **Fully working** — a real result is produced on the device or by a real outside service.
- **Partially working** — the screen exists and does something useful, but a piece is missing or limited.
- **Broken** — it can mislead a paying user, or it fails in a way that matters.
- **Stub only** — the button, file, or endpoint exists, but it is not a finished product.

### Document Studio (the home of the product)

Opened at `/workspace/documents`.

| Feature | Status | How it functions | Library or service | Where it lives |
|---|---|---|---|---|
| Scan papers with the phone camera | Fully working on the Android app | Opens the native document scanner, can keep more than one page, and can save them as images or one PDF. | `@capacitor-mlkit/document-scanner` | `apps/hub/src/mobile/views/ScanHomeScreen.tsx` |
| Scan enhancement (colour, grayscale, black and white, straighten sideways photos) | Fully working | Adjusts the photo in the browser before saving. | HTML Canvas | `apps/hub/src/lib/canvas/scanEnhance.ts` |
| Private document vault | Fully working offline | Saves files on the device. On the website this is the browser database (IndexedDB). On Android it is the app’s file storage. | IndexedDB + Capacitor Filesystem | `apps/hub/src/shared/services/LocalVaultService.ts` |
| Vault search, rename, and optional PIN lock | Fully working | PIN is checked on the device. It is a lock screen, not full file encryption. | Web Crypto (a standard browser lock) | `apps/hub/src/shared/services/vaultLock.ts` |
| Merge, split, compress, rotate, reorder, crop, page numbers, remove pages, watermark, organise | Fully working | All of this runs in the browser. The file is not uploaded. | `@cantoo/pdf-lib` and PDF.js (`pdfjs-dist`) | `apps/hub/src/lib/canvas/documentPdfTools.ts` and the matching modals in `apps/hub/src/components/canvas/` |
| Password protect and unlock a PDF | Fully working for normal PDFs | Done in the browser. | `@cantoo/pdf-lib` | `ProtectPdfModal.tsx`, `UnlockPdfModal.tsx` |
| Straighten, repair, strip hidden metadata, sign, redact | Fully working as browser tools | Sign and redact draw on the page in the browser. This is a visual signature and a black box over text, not a government digital signature and not a guarantee that deleted text is unrecoverable from every PDF trick. | `@cantoo/pdf-lib` | Matching `*PdfModal.tsx` files |
| Image to PDF, PDF to JPG/PNG, “scanned PDF” look | Fully working | Browser conversion. | Canvas + pdf-lib | `ImageToPdfModal.tsx`, `PdfToImageModal.tsx`, `PhotoScannedPdfModal.tsx` |
| Type on a PDF and save | Fully working | Adds text in the browser and downloads the PDF. | pdf-lib | `TypeSavePdfModal.tsx` |
| Make a scanned PDF searchable | Fully working, free, on device | Reads the page with OCR and hides that text in the PDF so search works. | Tesseract.js | `apps/hub/src/lib/canvas/searchablePdf.ts` |
| To Editable Format: plain text and Markdown | Fully working, free | Reads text already inside the PDF, or uses on-device OCR when the scan has little text. | PDF.js + Tesseract.js | `apps/hub/src/lib/services/toEditableFormatPipeline.ts` |
| To Editable Format: Word (`.docx`) | Partially working, paid | Sends the page to Google Gemini, gets HTML back, and builds a Word file on the phone. Layout is improved, not pixel-perfect. Needs the `GEMINI_API_KEY` secret on Cloudflare and a Pro account with credits. | `@google/genai`, model `gemini-2.5-flash-lite`, plus the `docx` library | `functions/api/pro/document-layout-html.ts`, `apps/hub/src/lib/canvas/htmlToDocx.ts` |
| To Editable Format: CSV and XML | Partially working, paid | Uses the same Gemini HTML, then converts tables on the device. Good for simple tables. Complex forms will be imperfect. | Gemini + local converter | `apps/hub/src/lib/canvas/htmlToStructured.ts` |
| To Editable Format: Excel (`.xlsx`) | Stub only | The button exists and tells the person Excel is coming soon. CSV is the workaround. | None yet | `toEditableFormatPipeline.ts` |
| Vision AI Extract (Markdown OCR) | Fully working when the secret and credits exist | Pro users upload a PDF or photo. Gemini reads it and returns Markdown, including tables. | Gemini 2.5 Flash-Lite | `functions/api/pro/document-ocr.ts`, `DocumentVisionOcrModal.tsx` |
| Older “smart extract”, “file converter”, and “layout reconstruction” cloud routes | Broken if someone calls them | These still contain fake pipelines. The main Word button no longer uses the fake layout route. The fake routes are still on the server. Some of them would still charge credits if called. | Placeholder code | `functions/api/pro/file-converter.js`, `smart-extract.js`, `extract.js`, `smart-router.js`, `reconstruct-layout.js` |

Known gap: a second mobile scanner screen (`ScannerScreen.tsx`) and its cloud converter are **not connected** to the screen people actually see. The live phone screen is `ScanHomeScreen.tsx`.

### Image Studio

Opened at `/workspace/image`. The old `/workspace/media` address is only a leftover alias.

| Feature | Status | How it functions | Library | Where |
|---|---|---|---|---|
| Exam photo (pixel size and file size in KB, colour or black and white) | Fully working | Resizes and compresses in the browser to match common exam portals. | Canvas | `apps/hub/src/lib/canvas/mediaExamPhoto.ts` |
| Resize and compress, convert JPG/PNG/WebP, crop, watermark, image to PDF | Fully working | Browser only. | Canvas, `browser-image-compression` | Matching modals |
| Adjust brightness, contrast, saturation, rotate, flip | Fully working | Browser only. | Canvas | `mediaAdjust.ts`, `ImageAdjustModal.tsx` |
| Filters | Fully working | Browser only. | Canvas | `ImageFilterModal.tsx` |
| Remove background | Fully working, free, on device | A cut-out model runs in the browser. First use downloads about 44 MB, then it can work offline. | `@huggingface/transformers`, model `briaai/RMBG-1.4` | `backgroundRemoval.worker.ts` |
| Upscale 4× | Stub only | Button is visible and marked “coming soon”. It cannot be run, so it does not charge credits. | Not connected | `mediaCanvasActions.ts` |
| AI photo restore | Stub only | Same as upscale. Marked coming soon. | Not connected | `mediaCanvasActions.ts` |

The old paid “remove background / upscale / restore” server route (`/api/pro/media-process`) is still in the code, but it refuses to run unless a `MEDIA_AI_ENDPOINT` secret exists. That secret is not part of the normal setup. The button people see for background removal is the free on-device tool, which is the right one.

### Video Studio

Opened at `/workspace/video`. All of these run on the device with **FFmpeg** (a video engine loaded as WebAssembly, about 32 MB the first time).

| Tool | Status |
|---|---|
| MP4 to MP3, compress, convert MP4/WebM/MOV, mute, GIF, trim, watermark, speed, crop/reframe (Reels, Shorts, status), extract a still frame | Fully working after the one-time engine download |

File: `apps/hub/src/lib/video/videoProcess.ts` and `apps/hub/src/config/videoCanvasTools.ts`.

Known limit: the first use needs a network to download the engine. After that, the app tries to keep it for offline use. Very long or very large videos can be slow or fail on a budget phone. That is a hardware limit, not a missing button.

### Career Prep

Opened at `/workspace/career`.

| Feature | Status | Notes |
|---|---|---|
| Legal document templates | Fully working | Local templates, not a lawyer. |
| Skill-gap helper | Fully working | Local comparison, not an outside AI. |
| Business card | Fully working | Built in the browser, can export. |
| ATS scanner | Partially working | Scores a **PDF** resume in the browser. Word files are refused. |
| Cover letter templates | Fully working | Local templates. |
| AI Resume Rewriter | **Broken** | The button is live. It sends resume text to `/api/pro/career-ai`, waits 3 seconds, and returns a **made-up rewrite**. The server then **takes 3 AI Credits**. The fake text even says it is a mock. |
| AI Cover Letter | **Broken** | Same path. Fake letter, real credit charge. |

The fake text is built in `functions/_lib/careerAiMock.mjs`. The charge happens in `functions/api/pro/career-ai.js`. The screen that calls it is `CareerPrepCanvas.tsx`.

### Finance Hub

Opened at `/workspace/finance`. These are real calculators and simple document builders. They run on the device.

Working tools: SIP, EMI, loan repayment, GST, tax-deduction notes, discount and margin, meeting cost, tip split, currency converter (needs the internet once, then caches rates for 12 hours), invoice PDF, pay stub PDF, crypto gains estimate, envelope budget, gig income tracker, salary calculator, salary benchmarking.

This is not accounting software and not tax advice. The GST and EMI maths are the useful part.

### Health and Lifestyle

Opened at `/workspace/lifestyle`.

Working, on device: BMI, body fat estimate, macro and calorie estimate, age and date maths, exam age eligibility, menstrual and ovulation estimate, mood log.

These are personal estimates stored on the device. They are not medical advice.

### Quick Tools

Opened at `/workspace/quick-tools`.

Working, on device: QR code, password generator, random number, unit converter, text format converter, percentage, scientific calculator, Base64, URL encoder, hash, colour palette, decision wheel, typing test, Pomodoro timer, countdown, SEO meta tags, recipe scaler, baby names, pet care schedule, garden planner, construction estimate, renovation budget, job tracker, cold-email builder.

### Things the old catalog still advertises, but this app does not have as its own pages

`apps/hub/src/config/toolsRegistry.ts` lists about 70 tools under addresses like `/tools/money/...` and a whole **Writing Studio** (handwriting image, speech to text, citations, plagiarism compare, a separate OCR page). **Those pages were never built in the current app.** The live app uses the seven workspace screens above. Searching the web for `/tools/writing` on this site will not open a finished writing studio.

There is **no language translation** feature (Hindi, Bengali, or otherwise). A search of the app found no translator.

There is **no separate data-analysis product**. Finance charts exist inside calculators (`chart.js`). That is not a spreadsheet analyst.

---

## 5. UI/UX & VISUAL STATE

Tailwind is the styling system for the real screens, not a leftover. Colours, type, and spacing come from one dark palette called `canvas` (near-black background `#121214`, soft green accent). The font is Inter, with the phone’s normal font as backup.

The interface is a **dark app**, not a light website with a dark-mode switch. There is no light theme and no toggle.

It is closer to a working product than a wireframe: toolbars, progress overlays, toasts, empty “drop a file” areas, and error messages exist on the main studios. Some older screens still say “coming soon”, which is honest for upscale and Excel, and dishonest for Career AI because that one still runs and charges.

How it behaves by screen size:

- **Phone (under 1024px wide, or the Android app):** Document Studio opens the scan-and-vault home (`ScanHomeScreen`), with large tap targets aimed at thumbs. Other studios stay usable but denser.
- **Tablet:** Treated as a phone until the window is wider than 1024 pixels. A tablet in portrait uses the phone layout. A wide tablet uses the desktop layout.
- **Desktop:** Document Studio opens the full tool canvas (`DocumentStudioCanvas`) with the file in the middle and tools around it.

Unfinished or leftover screens:

- The separate mobile `ScannerScreen` is not what users see.
- Writing Studio from the old catalog does not exist.
- Excel export is a labelled gap.
- Upscale and AI Restore are labelled “Soon”.

Loading, empty, and error states exist on the main flows (scan, convert, AI extract, video). They are not equally polished on every small calculator.

---

## 6. PWA & OFFLINE READINESS

A PWA is a website that can be installed on a phone like an app.

| Question | Answer |
|---|---|
| Manifest | Yes. `apps/hub/public/manifest.json`. Name “GramsevaMitra”, short name “Gramseva”, start page `/`, standalone display, portrait, theme colour indigo `#4f46e5`. |
| Icons | Yes. `pwa-192.png` and `pwa-512.png`, also used as the Apple touch icon. They are simple brand marks, not a full illustrated splash set. |
| Service worker | Yes. Built by Workbox into `sw.js` during `npm run build`. It is registered from the app shell. |
| What it caches | The app shell (HTML, CSS, JavaScript, icons). The last local build precached about **7.5 MB** across 153 files. API login calls are never cached. |
| Install on a phone | The manifest and service worker are valid enough for “Add to Home Screen” / browser install. The Android Studio / Capacitor app is a separate install. |
| Splash screen | The Android project has splash images. The website PWA uses the manifest colours and icons, not a custom animated splash. |
| Offline | **Free local tools work offline** after the app has been opened once: PDF tools, calculators, vault, scan edits. |
| Not offline | Sign-in, payments, Gemini OCR, Word layout AI, currency rates on first fetch, and the **first** download of FFmpeg, Tesseract language data, or the background-removal model. |

If the network drops on a page that was never cached, the app is set to show `/offline`.

---

## 7. WASM & HEAVY DEPENDENCIES

WebAssembly (often shortened to WASM) is a way to run heavy programs inside the browser. It is in use here. It is not sitting unused in `package.json`.

| Engine | Used? | When it downloads |
|---|---|---|
| PDF.js | Yes, for showing and reading PDFs | Inside the app build |
| pdf-lib (`@cantoo/pdf-lib`) | Yes, for editing PDFs | Inside the app build |
| Tesseract.js | Yes, for free OCR and searchable PDF | Worker and language data from a CDN, then cached for a year |
| FFmpeg (`@ffmpeg/ffmpeg`) | Yes, for every video tool | About 32 MB from a CDN on first use, then cached |
| ONNX / Transformers.js | Yes, for background removal | Model from Hugging Face on first use, then cached. A small `.wasm` file for that runtime is also produced in the build (`ort-wasm-simd-threaded`). |
| OpenCV, PaddleOCR | No | Old server comments mention Paddle and Google Vision. They are not installed. Those routes are blocked unless extra secrets are added. |

GPU / WebGL: background removal can use the browser’s neural-network runtime. Video and PDF tools do not require a gaming GPU. Budget phones will simply be slower.

Bundle size from the last local production build (`apps/hub/dist`, about **29 MB** on disk including maps and workers):

| Piece | Approx. size | What it is |
|---|---|---|
| Background-removal library | 874 KB | Loaded when that tool is used |
| PDF worker | about 600 KB | Needed to read PDFs |
| Document Studio screen | about 400 KB | Loaded when that studio opens |
| `compromise` (named `three.*.js` by the bundler) | about 345 KB | A text-analysis library, **not** the 3D library Three.js |
| Chart.js | about 200 KB | Finance charts |

The first page does not need to download FFmpeg or the cut-out model. Those stay off to the side until the person uses video or background removal.

There is no OpenCV and no PaddleOCR package in `package.json`.

---

## 8. BACKEND & EXTERNAL SERVICES

There is **no Supabase** folder, project, or client. Do not look for one.

| Service | Role | Wired up? |
|---|---|---|
| Cloudflare Pages | Hosts the site and the API | Yes, live |
| Cloudflare D1 | A small SQLite database bound as `DB`, id `df383016-db6c-4761-97ec-58a16c75efa5` | Configured in `wrangler.toml`. Used if Neon is not set. |
| Neon Postgres | Another user database. The code **prefers this** when `DATABASE_URL` is set. | Code is ready. Whether production actually has the secret cannot be seen from the repo. |
| Cloudflare R2 bucket `gramsevamitra-pro-transient` | Temporary file parking for older Pro uploads | Binding exists. Real Gemini OCR can also accept the file directly and does not depend on R2 for the main button. |
| Razorpay | Card / UPI checkout for Pro | Code is complete: create order, verify payment, webhook. Price in code is **₹99 per year** (`9900` paise). Live versus test keys are a Cloudflare secret, not visible here. |
| Amazon SES | Sends login one-time codes | Code exists. Needs SES secrets. |
| Resend | Sends the contact-form email | Code exists. Needs `RESEND_API_KEY`. |
| Cloudflare Turnstile | Bot check on the public contact form | Yes, on `/contact` |
| PostHog | Product analytics | Yes, loaded in the main layout. It is skipped on the native app and when the device is offline. The project key in the page is a public analytics key, which is normal for this product. It is not a server password. |
| Google Gemini | Real OCR and Word layout | Yes, if `GEMINI_API_KEY` is set on Cloudflare |
| Google sign-in | Login | Yes, if Google OAuth secrets are set |
| Frankfurter | Currency rates | Yes, from the finance converter |
| Anthropic Claude | A helper file was added on a side branch | **Not used by any screen.** Not on the live `main` branch. |
| Instamojo | Mentioned only as a disabled example in `.env.example` | Not a live payment path |

### Environment variables the project expects

From `.env.example` and the cloud code. Values belong in Cloudflare, not in GitHub.

**Required for a real production login and Pro checkout**

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (already set to `https://gramsevamitra.com` in `wrangler.toml`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `DATABASE_URL` (Neon) and/or the D1 binding `DB`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `PUBLIC_PAYMENTS_ENABLED`

**Required for the AI features that are actually real**

- `GEMINI_API_KEY`

**Required for email and the contact form**

- `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`
- `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`
- A public Turnstile site key is also used on the contact page

**Optional / only if you deliberately turn an old engine on**

- `MEDIA_AI_ENDPOINT` (4× upscale and AI restore server)
- `LAYOUT_RECONSTRUCTION_ENDPOINT` (old fake layout route)
- `PADDLE_OCR_ENDPOINT`, `GOOGLE_VISION_API_KEY` (old OCR waterfall)
- `ANTHROPIC_API_KEY` (unused Claude helper)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (for deploy scripts)
- `SES_TEST_SECRET` (admin mail test)

Public build-time values in `.env.example` (`PUBLIC_RAZORPAY_KEY_ID`, old optimizer prices, Instamojo link) belong to an earlier four-app layout. They are not the heart of the current hub.

---

## 9. DATABASE STATE

Two schemas exist. They describe the same idea in two databases.

| Table | What it stores | Important columns |
|---|---|---|
| `users` | Accounts | `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, **`plan`** (default `free`), **`credits`** (default `0`) |
| `sessions` | Login sessions | `id`, `token`, `expiresAt`, `userId` |
| `accounts` | Google (or other) login links | `providerId`, `accountId`, `userId`, tokens |
| `verifications` | One-time codes | `identifier`, `value`, `expiresAt` |
| `billing_events` | Razorpay payments already recorded | `razorpay_order_id`, `razorpay_payment_id`, `user_id`, `amount_paise` (default 9900), `status` |

There is **no separate subscriptions table**. Pro means `users.plan` is `'pro'`.

Files: `schema.sql` (Cloudflare D1 / SQLite) and `schema.postgres.sql` (Neon).

Row Level Security: **does not apply**. That is a Supabase/Postgres feature this project does not use. Access is checked in the cloud functions (you must be signed in, and Pro routes also check the plan and credit balance).

Seed data: **none found.**  
Migrations folder: **none.** Schema changes are those two SQL files, applied by hand (`npm run db:migrate:local` or `db:migrate:remote` for D1).

Which database production is actually using on 10 October 2026 is **not visible from the code**. If both `DATABASE_URL` and D1 are set, the code talks to **Neon first**.

---

## 10. AUTHENTICATION & USER MANAGEMENT

Authentication is implemented with **Better Auth**.

Methods in the cloud auth file:

- **Google sign-in**
- **Email one-time code** (a short code sent by Amazon SES, not a password and not a magic link)

There is a “keep me signed in” choice stored in the browser.

There is **no dedicated profile page** (no screen for name, photo, and account settings beyond sign-in and the Pro upgrade).

Credits and subscription:

- Price in code: **₹99 per year**
- Pro users are supposed to receive a monthly pool of **30 AI Credits** (`PRO_MONTHLY_CREDIT_FUP`)
- Typical AI action cost: **2 credits** (document AI), **3 credits** (career AI)
- The upgrade screen and Razorpay flow exist (`apps/hub/src/lib/billing/useRazorpay.ts`, `functions/api/billing/`)

Whether real customers can pay today depends on the Razorpay keys in Cloudflare being live keys, not test keys. This audit cannot see those keys.

---

## 11. INCOMPLETE FEATURES & BUILD HEALTH

Unfinished on purpose or by leftover:

- Excel `.xlsx` export
- 4× upscale and AI photo restore
- Language translation
- The old `/tools/*` catalog and Writing Studio pages
- Claude helper (`functions/_lib/claudeClient.mjs`) — only on the side branch, called by nothing
- Mobile `ScannerScreen` — built, not shown
- `SmartDocumentExtractorTool.tsx` — built, not shown
- High-fidelity file converter modal — moved to `.stale_archive/`

TODO / FIXME comments: **none** in the application source. The gaps are unmarked in comments. They show up as “coming soon”, `mock: true`, or files that nothing imports.

Build health on 10 October 2026:

| Check | Result |
|---|---|
| `npm run typecheck` | Passed, just now, with no TypeScript errors |
| `npm run build` | Not re-run during this audit. The same code built and deployed successfully on 5 August 2026, and the only later change on `main` was the Node 22 pin, which does not affect the website build. A fresh build is very likely to succeed. |
| ESLint | **Not set up.** There is no ESLint config and no lint script. |
| Console errors on load | Not re-tested in a browser during this audit. The live site did return the Document Studio page. |

---

## 12. DEPENDENCY HEALTH

`npm audit` on 10 October 2026 reported **49 issues: 5 critical, 31 high, 13 moderate.**

The five marked critical:

- `@capacitor/android` and `@capacitor/ios` — a security note about the native shell loading remote content inside the app origin. Relevant before a wide Play Store push. Not a website bug by itself.
- `astro` — a host-header issue in the framework. Mostly matters if the server reflects that header. Worth upgrading Astro when you next touch the build, not an emergency outage.
- `handlebars` and `tar` — these sit in the **build and install tools**, not in the screens a visitor uses.

Unused or leftover dependencies and code:

- `compromise` is in the website bundle (the file whose name starts with `three.`). Confirm it is still needed by a career or writing helper before deleting it. It is heavy.
- `@neondatabase/serverless` and D1 are both present. One of them may be unused in production.
- The Claude client is unused.
- Several Pro API files are leftover mocks.
- `.stale_archive/` holds old copies of screens. It is clutter, not the live app.

No evidence of a library imported in the website but missing from `package.json`. `npm run typecheck` would have failed on a missing type that the app compiles against, and it passed.

Dependencies are **not fully up to date**. Astro 4 and Wrangler 3 are a generation behind current major releases. Do not upgrade them as a drive-by. Do it as its own task with a full build afterwards.

---

## 13. FOLDER STRUCTURE

```text
GramsevaMitra/
├── apps/hub/                 ← the only application (website + phone UI)
│   ├── src/pages/            ← Astro routes (workspace, billing, legal, contact)
│   ├── src/components/       ← React studios and modals
│   ├── src/mobile/           ← phone-only scan, vault, upgrade screens
│   ├── src/lib/              ← PDF, image, video, OCR, billing logic
│   ├── src/config/           ← the lists of tools
│   ├── src/workers/          ← background OCR and background-removal workers
│   └── public/               ← manifest, icons
├── packages/shared/          ← shared UI shell, file download, Tailwind
├── packages/auth/            ← login client
├── functions/                ← Cloudflare API (login, Razorpay, Gemini, leftovers)
│   ├── api/pro/              ← paid document and media endpoints
│   ├── api/billing/          ← Razorpay
│   ├── api/auth/             ← Better Auth
│   └── _lib/                 ← shared server helpers
├── android/                  ← Capacitor Android project
├── ios/                      ← Capacitor iOS project
├── docs/                     ← this file and the short vision note
├── .github/workflows/        ← deploy website, build debug APK
├── schema.sql                ← D1 database
├── schema.postgres.sql       ← Neon database
├── wrangler.toml             ← Cloudflare project, D1, R2
└── .stale_archive/           ← old copies. Not part of the build.
```

Confusing duplicates:

- **Two databases** for the same users (D1 and Neon).
- **Two document-to-Word paths** (real Gemini HTML route, and an older mock reconstruction route).
- **`toolsRegistry.ts` versus the real workspaces.** The registry describes a site shape that the pages do not implement.
- **`LAUNCH_CHECKLIST.md`** still describes four Cloudflare apps. Only the hub exists.
- **`.gramseva_knowledge/`** is an internal notes area for AI memory. It is not the product.
- **`cloudflare/`** at the repo root is not the live worker source. The live API is `functions/`.

The main product logic is `apps/hub/src` plus `functions/api` and `functions/_lib`.

---

## 14. GIT & VERSION CONTROL

| Item | State on 10 October 2026 |
|---|---|
| Git repository | Yes |
| GitHub | [https://github.com/synergisticforce/gramsevamitra](https://github.com/synergisticforce/gramsevamitra) (public) |
| Branch this audit was written on | `feature/claude-prompt-caching` |
| Branch that is actually live | `main` |
| Uncommitted changes | None, before this blueprint file |
| Last commit on `main` | `3202a63` — “fix: bump Node.js to 22 to unblock APK build” — **5 August 2026** |
| How this branch differs from live | It also contains `9b7e168` “feat: add Claude API prompt caching client”. That file is not used by the app and is **not** what visitors are running. |
| `.gitignore` | Yes, and it is adequate. It excludes `node_modules`, `.env`, build folders, Android keystores, and Wrangler local state. |

Do not merge the Claude branch just to “clean up git” unless you want that unused file on `main`. It does not fix a user-facing bug.

---

## 15. WHAT IS MISSING (GAP ANALYSIS)

### DONE

- Live website on gramsevamitra.com with HTTPS
- Installable PWA plus an Android project whose debug APK build is green
- Offline-first document vault, including multi-page scan, filters, search, rename, and a PIN lock
- A broad free PDF toolkit (merge, split, compress, protect, sign, redact, searchable PDF, and the rest of the toolbar)
- Free on-device OCR (Tesseract) and a real paid Gemini reader
- Word, CSV, and XML export through Gemini for Pro, with honest errors when the key or credits fail
- Image studio: exam photo, crop, compress, adjust, filters, background removal
- Video studio: the full local FFmpeg set, including 9:16 reframe
- Finance, lifestyle, and quick-tool studios
- Google login, email code login, Razorpay order flow, credit ledger
- Deploy pipeline that typechecks, builds, and ships to Cloudflare

### PARTIALLY DONE

- Word and table export. Real, but not a perfect visual copy of every government form. Excel is missing.
- Career ATS scan. PDF only.
- Pro billing. The code is there. Live-versus-test keys and which database is primary are not proven from the repo.
- Android release. Debug APK yes. Play Store listing unknown.
- Background removal, video, and OCR. Real, but the first run needs a large download.
- Icons and visual system. Consistent and dark, not yet a finished brand system with light mode, motion, and a proper empty-state pass on every small tool.

### NOT STARTED

- Translation between languages
- A real Excel `.xlsx` writer
- 4× upscale and AI photo restore
- Writing Studio as its own area (speech, citations, handwriting export)
- A user profile page
- Full file encryption for the vault (the PIN only locks the screen)
- A standing staging site
- ESLint
- Using the Claude helper for anything

### BROKEN and needs fixing before anything new

1. **Career AI charges credits for fake text.** This is the only live button that both runs and bills for a placeholder. Fix or hide it before any marketing, demo, or Play Store push.
2. **Old Pro endpoints can still bill for fake work** if anything calls them: file converter, smart extract, smart router, and the old layout reconstruction route. The main screen has mostly moved on. The server routes have not all been locked the way upscale was locked.
3. **Two user databases.** If Neon and D1 ever both have users, a person can pay in one place and look free in the other. Pick one and write that choice down.
4. **Docs that describe four apps and `/tools/*` pages.** They will send the next person (or the next AI session) to fix things that are not the product.

---

## 16. RECOMMENDED NEXT STEPS

**Highest priority:** turn off AI Resume Rewriter and AI Cover Letter, or stop them from deducting credits, until a real model writes the text. A three-line fake resume that costs credits is worse than a missing button.

Next, in order:

1. Hide or hard-block the other mock Pro routes (`file-converter`, `smart-extract`, `extract`, `smart-router`) the same way upscale is already blocked, so a future screen cannot bill for them by accident.
2. Decide, in Cloudflare, which database is real (Neon or D1) and whether Razorpay is in live mode. Write the answer into this file’s section 17 once you know.
3. Only after those are safe: add real Excel export, or replace Career AI with Gemini using the same pattern as document OCR.
4. Then decide the Play Store release. The debug APK path is already green. A store release needs the signing key, a privacy policy check, and a pass on the Capacitor security note.

**Do not touch right now**

- The free PDF toolbar, vault, scan flow, and PWA setup. They are the working core.
- The Node 22 pin. It is why the APK build is green.
- A framework upgrade (Astro 5, a new UI kit, a rewrite). It will burn weeks and not make the product more trustworthy.
- The Claude branch. It is unused.

**Risks**

- The repo has been idle since 5 August 2026. Secrets in Cloudflare (Gemini, Razorpay, Google) can expire or be rotated without the code changing. If Word export fails in production, check the Gemini key and credit balance before changing code.
- `npm audit` is noisy. Do not run `npm audit fix --force`. That command upgrades major versions blindly and can break the build.
- Shipping the Android app while Career AI still bills for mock text would put a trust problem on every phone.

---

## 17. OPEN QUESTIONS FOR THE FOUNDER

These cannot be answered from the code. Your answers decide the next build.

1. Is Razorpay currently in **test mode or live mode** on gramsevamitra.com? Has anyone actually paid ₹99?
2. Which database should be the only one: **Neon or Cloudflare D1**? If you do not know, we should check Cloudflare and Neon before writing more billing code.
3. Is the Android app already on the **Play Store**, or is the debug APK from 5 August the latest build you have?
4. For Career AI, do you want it **hidden immediately**, or replaced with a real Gemini rewrite in the next session?
5. Is **₹99 per year and 30 credits a month** still the offer you want to sell?
6. Do you still want **translation**, **Excel**, and **AI upscale** in that order, or is a trustworthy document studio (scan, PDF, Word, exam photo) the whole product for the next month?
7. Should `utilities.gramsevamitra.com` stay as a second door to the same app, or is that leftover and confusing?

---

## How this audit was done

Files read include `package.json`, both Wrangler configs, the tool registries, the Pro API folder, both SQL schemas, the PWA manifest, the Astro config, `.env.example`, the deploy workflows, and the live HTTP response from gramsevamitra.com. `npm run typecheck` and `npm audit` were run on 10 October 2026. The full production build was not repeated today because `main` has not changed since the green deploy on 5 August 2026.
