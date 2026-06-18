# GRAMSEVA MITRA - MASTER DEVELOPMENT PLAN & CONSTRAINTS

**CRITICAL DIRECTIVE FOR CURSOR:** You are assisting a non-technical founder. Read, understand, and strictly adhere to this document before executing ANY code changes. Write robust, error-handled, production-ready code. 

## 1. UI/UX & Visibility Rules (Phase 1 - Completed)
* **Dark Mode Contrast:** Maintain high-contrast Tailwind classes (`text-slate-200`, `text-white`) across all `bg-canvas-surface` elements.
* **Workspace Cleanliness:** Standalone tools remain visible. "Related/Dependent" tools must be hidden from the default view and only reveal themselves *after* a user successfully uploads a document.
* **Loading States:** Every tool must use global "Processing... Please wait" spinners during tasks.

## 2. The "No Size Limit" Chunking Architecture (Phase 2 - Active)
* **The Absolute Rule:** FILE SIZE IS NEVER LINKED TO THE PRO PLAN. Free users can upload and process files of ANY size (including 5GB+ files) using Free tools without ever hitting a paywall.
* **Dynamic local processing limits:** 50MB for mobile/tablets, and 1GB (1024MB) for desktop.
* **The Architecture:** Implement the background "Smart Slicing Pipeline" using 20MB chunks. If a file exceeds the device-aware local limit above, automatically slice it, stream it to our Cloudflare backend for FREE processing piece-by-piece, and merge the final output back to the user. Device type is detected via `navigator.userAgent` and `navigator.maxTouchPoints` (for iPadOS).
* **Storage Constraint:** Use `PRO_TRANSIENT` R2 bucket for temporary staging during chunking. The Worker MUST delete chunks immediately after the final file is streamed to prevent storage costs.

## 3. Advanced OCR Architecture & Fallbacks (Phase 3 — Active)
Implement a tiered, fail-safe OCR engine system:
* **Tier 1 (Free / Local):** Default to `Tesseract.js` (WebAssembly worker) with mandatory grayscale + high-contrast threshold preprocessing. Multi-page PDFs sample the first 2 pages. Hand off to Pro ONLY when average confidence **< 65%** or gibberish is detected (not by character length).
* **Tier 2, Step 1 (Paddle OCR):** Serverless GPU open-source weights via `/api/pro/ocr-orchestrator`. Routes to GLM when word confidence **< 80%**, structured layout is detected, or Smart Extract JSON/CSV is requested.
* **Tier 2, Step 2 (GLM OCR):** Vision-language layout reconstruction. Falls back to Google Cloud Vision when inference exceeds **30s** (excluding cold-start grace) or JSON schema is broken.
* **Tier 3 (Google Cloud Vision):** Paid per-call emergency fallback. Returns a clean unreadable notice if all tiers fail.

## 4. Platform Housekeeping & Pro Upsell Logic
* **Strict Pro Trigger:** Pro plans should ONLY be suggested if:
  1. The user explicitly clicks a premium tool marked with a `[PRO]` badge.
  2. A Free tool technically fails to complete a task (e.g., basic OCR fails) and a Pro tool is required to succeed. 
* **Contact:** All support channels must strictly use `support@gramsevamitra.com`.

## 5. Workspace Expansion & Tool Injections
* **Document Studio:** Build 'Organise PDF Pages' (Drag & Drop), 'Repair Corrupt PDF', 'Photo to Scanned PDF', 'Strip PDF Metadata', 'Sign PDF', and 'Secure Document Redactor'. *(Completed — all six tools wired in Document Studio with local/chunked sizing.)*
* **Quick Tools:** Expand the 'Unit Converter' globally. Add 'Typing Speed Test', 'Pomodoro Focus Timer', 'Event Countdown', 'Random Number Generator', and 'Format Converter (JSON/CSV/XML)'. *(Completed — 22 tools in Quick Tools workspace.)*
* **New Health & Lifestyle Workspace:** Build 'BMI Calculator', 'Body Fat Calculator', 'Age & Date Calculator', 'Exam Age Eligibility', 'Menstrual & Ovulation Calculator', 'Mood & Daily Log', and 'Macro & Calorie Calculator'. *(Completed — `/workspace/lifestyle` with 7 client-side tools.)*
* **New Video Workspace:** Build a dedicated workspace for Video File Conversion tools. *(Completed — `/workspace/video` with FFmpeg.wasm, client-only.)*