# GRAMSEVA MITRA: ENGINEERING MASTER BIBLE

**Project Identity:** An enterprise-grade, offline-first, client-side utility and productivity suite built for a global audience of professionals, students, and creators.
**Core Mandate:** Systematically upgrade all 83 tools to match or exceed top global SaaS alternatives while remaining 100% free of cost, ad-light, and privacy-first.

---

## 1. CORE ARCHITECTURAL COMMANDMENTS

* **Zero-Server Processing:** All intense operations (PDF manipulation, image optimization, OCR, client-side text analysis) MUST execute 100% locally in the browser using WebAssembly (WASM), Web Workers, and the HTML5 Canvas API. No files or user data may be transmitted to a backend.
* **Astro + React Synergy:** Use Astro for static site generation and routing. Use React for isolated interactive tool components ("islands").
* **State Management Strictness:** React components must NEVER execute processing logic or trigger long-running operations automatically upon mounting. Variables like `isProcessing`, `isWorking`, or `loading` must strictly default to `false`. Processing must only trigger via an explicit user event (e.g., selecting a file or clicking a trigger button).
* **The Cross-Subdomain Routing Law:** This project is a monorepo deployed across distinct subdomains. Because Astro's `<ViewTransitions />` can intercept and break cross-app or cross-subdomain transitions, **any navigation link exiting a sub-app or returning to the true root dashboard MUST explicitly use the `data-astro-reload` attribute** to trigger a clean browser layout cycle.
* **Performance & Asset Loading:** Heavy packages or runtime engines (e.g., `pdf.js`, `tesseract.js`, `compromise.js`) must be asynchronously and dynamically imported (`await import(...)`) inside functions to optimize bundle sizing and bypass Vite chunk thresholds.

---

## 2. THE GLOBAL UX/UI STANDARD

Every utility must be leveled up to enterprise SaaS capabilities:
1. **Universal Copy & Tone:** Avoid regional phrasing or hyper-specific terminology. Maintain clean, direct, globally understood professional vocabulary.
2. **Interactive Instant Feedback:** Provide clear real-time counters, status indicators, file size comparison deltas (e.g., "Original vs. Compressed"), and visual process indicators.
3. **Aggressive Data Sanitation:** Built-in static assets (such as CSV or JSON lists) must be scrubbed of noise, titles, honorifics, and duplicate values before hitting client states. UI filters must compile *dynamically* from existing data fields; never use hardcoded filter value arrays.

---

## 3. MASTER TOOL REGISTRY & GLOBAL BENCHMARKS

When upgrading a tool, the engineer MUST reference this table to ensure the tool's feature set and UX matches or exceeds the stated "Global Benchmark."

| Tool Name | Global Benchmark | Target UX / Key Advantage to Implement |
| :--- | :--- | :--- |
| **Government Exam Document Optimizer** | ResizePixel.com | Precise pixel/KB control, aspect-ratio locking, multiple format support, exact file size targeting. |
| **ATS Resume Scanner & Keyword Checker** | Jobscan.co | Real ATS algorithms, detailed match reports, missing keyword highlighting, formatting tips. |
| **Compress PDF Size** | Smallpdf.com | Balance of compression vs. quality, side‑by‑side preview, exact file size targeting. |
| **Repair Corrupt PDF** | PDF2Go.com | Robust repair algorithm that recovers damaged XREF tables and broken streams. |
| **Straighten/Deskew Pages** | DeftPDF.com | Automatically detects tilt angle, batch deskews all pages, accurate edge detection. |
| **Photo to Scanned PDF** | ScanWritr.com | Simulates flatbed scanner output (brightness/contrast, background cleaning). |
| **Strip PDF Metadata** | PDFCandy.com | Strips hidden info (author, software, timestamps, thumbnails), shows preview before stripping. |
| **Merge Multiple PDFs** | ILovePDF.com | Drag‑and‑drop page reordering, works on huge files seamlessly. |
| **Split & Extract Pages** | ILovePDF.com | Extract by range, split all pages into separate files, or extract every N pages. |
| **Remove PDF Pages** | Smallpdf.com | Thumbnail view of all pages, select and delete with instant preview. |
| **Rotate All Pages** | ILovePDF.com | Bulk rotate all pages (CW/CCW), handles mixed orientations. |
| **Reorder PDF Pages** | Smallpdf.com | Drag‑and‑drop thumbnails, real‑time ordering. |
| **Add Page Numbers** | PDF24.org | Customizable position, font, size, starting number, prefix/suffix, and page range. |
| **Add Watermark** | ILovePDF.com | Text or image watermark, opacity, rotation, tile mode, page range selection. |
| **JPG to PDF** | ILovePDF.com | Page orientation, margin, image size options, merge all into one PDF. |
| **PNG to PDF** | ILovePDF.com | Same as JPG to PDF, but preserves alpha/transparency channels perfectly. |
| **Text/Word to PDF** | Smallpdf.com | Preserves formatting, tables, and standard fonts. |
| **HEIC/iPhone to PDF** | CloudConvert.com | Handles HEIC/HEIF decoding with original quality retention. |
| **Type & Save as PDF** | PDFEscape.com | Rich text editing inside PDF, add text boxes, download natively. |
| **PDF to JPG** | Smallpdf.com | Extracts each page as high‑quality JPG (up to 300 DPI). |
| **PDF to PNG** | PDF24.org | High‑resolution PNG export, transparent background option. |
| **PDF to Text** | PDF2Go.com | Extract plain text fast, built‑in OCR fallback for image‑based PDFs. |
| **PDF to Word/Text File** | ILovePDF.com | Converts with layout retention, maintains basic tables. |
| **Organise PDF Pages** | ILovePDF.com | Merge, rotate, delete, reorder in one unified drag‑and‑drop interface. |
| **Sign PDF (Self-Attestation)** | Smallpdf.com | Draw, type, or upload signature, place anywhere via canvas. |
| **Crop PDF Page** | Sejda.com | Visual crop handles, preview cropping before applying, precise margin control. |
| **Unlock PDF** | ILovePDF.com | Removes password instantly. |
| **Protect PDF** | ILovePDF.com | Set owner/user passwords, restrict printing/copying/editing via encryption. |
| **EMI Calculator** | Calculator.net | Detailed amortization table, pie chart, yearly breakdown, prepayment option. |
| **SIP Calculator** | Calculator.net | Shows year‑wise investment growth with chart, inflation adjustment, step‑up option. |
| **GST Calculator** | ClearTax / SalesTaxCalculator | Handles inclusive/exclusive tax, multi‑rate, detailed breakdown. |
| **Discount & Margin Calculator** | OmniCalculator.com | Calculates margin, markup, profit, and discount % with interactive visual sliders. |
| **Loan Repayment Planner** | Bankrate.com | Full amortization schedule, extra payment calculator, compare loan scenarios. |
| **Tip & Split Calculator** | Calculator.net | Custom tip %, split by number of people, round up, total per person. |
| **Multi‑currency Converter** | XE.com | Live APIs, mid‑market rates, trusted globally. |
| **Invoice Builder** | Zoho Invoice | Professional templates, auto calculations, clean PDF export. |
| **Pay Stub Generator** | PayStubCreator.net | Auto‑calculates gross/net pay, deductions, YTD totals, professional PDF. |
| **Meeting Cost Calculator** | Clockify | Based on attendee hourly rates, shows real‑time ticking cost as meeting runs. |
| **Tax Deduction Tracker** | TaxDome / ClearTax | Categorizes expenses, estimates tax savings, organized reports. |
| **Crypto Capital Gains** | CoinTracker.io | Supports standard FIFO/LIFO formats, generates clean reports. |
| **Gig Income** | Hurdlr.com | Mileage, expense, and income tracking, tax estimates. |
| **Envelope Budget** | Goodbudget.com | Digital envelope system, track spending categories visually. |
| **Smart Writing Studio** | Grammarly | Clarity, tone, word count, readability statistics in a clean editor. |
| **Job Application Tracker** | Huntr.co | Kanban board, job details, browser-based storage. |
| **Salary & Take‑Home Calculator** | ADP | Calculates net pay after standard deductions, highly precise. |
| **Cold Email Builder** | HubSpot | Professionally designed email templates for outreach, preview and copy. |
| **Business Card Generator** | Canva | Clean templates, canvas manipulation, download print‑ready PDF/PNG. |
| **Salary Benchmarking** | Glassdoor.com | Filter by location, experience, role. |
| **Skill Gap Analyzer** | LinkedIn | Self-assessment mapping, industry-recognized skill tagging. |
| **Legal Templates** | RocketLawyer.com | Guided interview flow for standard documents, free generation. |
| **Typing Speed Test** | Monkeytype.com | Minimalist, highly customizable, character-by-character validation, live WPM stats. |
| **ATS Resume Keyword Matcher** | ResumeWorded.com | Instant keyword analysis, ATS score, actionable improvement suggestions. |
| **Pomodoro Focus Timer** | Pomofocus.io | Customizable work/break intervals, task list, dark mode, audio alerts. |
| **Event Countdown** | TimeandDate.com | Custom background, shareable link, accurate to the second. |
| **BMI Calculator** | Calculator.net | Metric/imperial, health risk category chart, visual gauge. |
| **Body Fat Calculator** | Calculator.net | Multiple formulas (Navy, etc.), tape measurement input, visual guide. |
| **Age & Date Calculator** | TimeandDate.com | Difference in days/weeks/months/years, include/exclude weekends. |
| **Exam Age Eligibility** | OmniCalculator.com | Flexible date‑range logic, checks eligibility instantly. |
| **Menstrual & Ovulation Calculator** | BabyCenter.com | Predicts next periods, fertility window, calendar view. |
| **Mood & Daily Log** | Moodscope.com | Track mood, graph trends, clean UI. |
| **Macro & Calorie Calculator** | Calculator.net | Calorie target, macronutrient split based on goals, multiple activity levels. |
| **QR Code Generator** | QRCode‑Monkey.com | Custom colors, logo integration, high‑res download (PNG/SVG/PDF). |
| **Exam Photo & Signature Studio** | IDPhoto4You.com | Resizes, crops, complies with biometric standards via canvas. |
| **Secure Document Redactor** | PDF24.org | Permanent blackout via canvas, truly removes underlying data offline. |
| **Unit Converter** | Metric‑Conversions.org | Comprehensive categories (temp, length, weight, volume, etc.). |
| **Percentage Calculator** | Calculator.net | All modes: % of, % change, increase/decrease, reverse %. |
| **Scientific Calculator** | Desmos | Advanced functions, variables, beautiful mathematical UI. |
| **Password Generator** | LastPass | Length slider, character types, highly secure pseudo-randomness, one-click copy. |
| **Random Number Generator** | Random.org | Clean logic, multiple modes (range, sequence). |
| **Base64 Encoder/Decoder** | Base64Decode.org | Fast encode/decode, supports text/files. |
| **URL Encoder/Decoder** | URLencoder.org | Strict RFC compliance, live preview. |
| **Crypto Hash Generator** | CodeBeautify.org | MD5, SHA‑1, SHA‑256, SHA‑512. Wide algorithm support. |
| **Format Converter** | CodeBeautify.org | Bidirectional conversion (JSON/CSV/XML), formatting, validation. |
| **Color Palette Generator** | Coolors.co | Upload image, extract dominant colors via canvas, export palettes. |
| **Baby Name Finder** | Nameberry.com | Advanced dynamic filters (origin, meaning, gender), heavily sanitized lists. |
| **Decision Wheel** | PickerWheel.com | Custom entries, canvas spinning animation, confetti. |
| **SEO Meta Tag Generator** | Moz | Google SERP snippet preview, character/pixel counters. |
| **Recipe Scaler** | WebstaurantStore | Scale ingredients by servings, handles fractions, converts units. |
| **Pet Feeding Scheduler** | PetMD | Breed‑specific, age‑adjusted, calorie‑based logic. |
| **Gardening Planner** | Almanac.com | Frost dates, localized logic, moon phases. |
| **Construction Estimator** | Calculator.net | Concrete, brick, lumber estimators with visual diagrams. |
| **Home Renovation Budget** | HomeWyse.com | Detailed line‑item cost breakdown by room/finish level. |

---

## 4. THE WAVE STRATEGY (ROADMAP)

To avoid context exhaustion and memory corruption within AI development, upgrades must be executed in strict thematic waves.

* **WAVE 1:** Core Flagships & Infrastructure (Document Optimizer, PDF Compressor, Core Layout, Data Sanitation).
* **WAVE 2:** The Document & PDF Suite (Merge, Split, Protect, OCR, Deskew).
* **WAVE 3:** Professional Career Suite (ATS Scanner, Typing Test, Job Tracker).
* **WAVE 4:** Financial & Mathematical Calculators (EMI, Salary, Crypto Tax).
* **WAVE 5:** Business & Creative Utilities (SEO, SVG, Color Palettes).
* **WAVE 6:** Daily Life & Micro-Tools (Unit Converters, Generators).

### DEPLOYMENT & VERSION CONTROL LAW (GITOPS ONLY)
1. **No Local Deployments:** Under no circumstances are you (the AI) to suggest, write, or execute local deployment commands (e.g., `npm run deploy`, `npx wrangler pages deploy`).
2. **GitHub is the Source of Truth:** All code modifications must be staged, committed, and pushed to the `main` branch on GitHub. Cloudflare Pages is strictly configured to auto-deploy via GitHub webhooks.
3. **Commit Protocol:** When finishing a task or wave, your final instruction to the user should ALWAYS be to verify the build (`npm run build:all`) and then execute a standard Git push sequence (`git add . && git commit -m "..." && git push`).