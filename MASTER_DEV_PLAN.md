# GRAMSEVA MITRA - MASTER DEVELOPMENT PLAN & CONSTRAINTS

**CRITICAL DIRECTIVE FOR CURSOR:** You are assisting a non-technical founder. You must read, understand, and strictly adhere to this document before executing ANY code changes. Write robust, error-handled, production-ready code. Execute work strictly in phases. Always explain deployments simply.

## 1. UI/UX & Visibility Rules (Phase 1)
* **Dark Mode Contrast:** Text is currently invisible or hard to read in multiple areas (specifically the Currency Converter figures, Document Studio, and Career workspaces). Globally enforce high-contrast Tailwind classes (`text-slate-200`, `text-white`, or `text-canvas-text`) across all `bg-canvas-surface` and `bg-canvas-elevated` elements.
* **Disappearing UI Bug:** Fix the state management bug where selecting or dropping multiple files causes the tool selection grid to hide or disappear.
* **Workspace Cleanliness (Career Prep):** Standalone tools (Salary Calc, Legal Docs, etc.) must remain visible by default. "Related/Dependent" tools (ATS Scanner, AI Resume Rewriter, etc.) MUST be completely hidden from the default view and only reveal themselves *after* a user successfully uploads a document.
* **Loading States:** Every single tool must have a clear "Processing... Please wait" visual state or spinner to prevent users from clicking buttons multiple times during heavy tasks.

## 2. Unlimited File Size Processing & Smart Slicing (Phase 2)
* **The Rule:** Free users can upload and process files of ANY size (including 5GB+ files) on both mobile and desktop without being forced into a Pro plan. 
* **The Architecture:** Implement a background "Smart Slicing Pipeline" using 20MB chunks. If a file exceeds safe local browser memory (~50MB), automatically slice it, stream it to our Cloudflare backend for FREE processing piece-by-piece, and merge the final output back to the user. This avoids holding massive files in server storage or browser RAM.
* **File Uploaders:** Ensure all `<input type="file">` tags for tools like Merge have the `multiple` attribute enabled by default.

## 3. Advanced OCR Architecture (Phase 3)
Implement a tiered, fail-safe OCR engine system for Image-to-Word/Text:
* **Tier 1 (Free / Local):** Default to `Tesseract.js` for browser-based extraction.
* **Tier 2 (Pro / Serverless GPU Fallback):** If Tier 1 fails, or the user is on the Pro plan for complex extraction, route to a Serverless GPU. Use **Paddle OCR** or **GLM OCR** as the primary engine, with **Google Cloud Vision** as the secondary fallback.

## 4. Platform Housekeeping & Business Logic
* **Pro Upsell Trigger:** Pro features or plans should ONLY be suggested when a free tool truly fails to process a task due to layout/font complexity, or if the user explicitly clicks a premium Pro tool. 
* **Support Email:** All contact channels, forms, and pages must strictly use `support@gramsevamitra.com`.

## 5. Workspace Expansion & Tool Injections
Based on our comprehensive tool audit, the following missing utilities must be built and wired into the UI:

* **Document Studio Fixes:** 
  * Restore the hidden 'Compress' tool. 
  * Build a unified, drag-and-drop 'Organise PDF Pages' tool.
  * Add 'Repair Corrupt PDF', 'Photo to Scanned PDF', 'Strip PDF Metadata', 'Sign PDF (Self-Attestation)', and 'Secure Document Redactor'.
* **Quick Tools Expansion:** 
  * Massively expand the 'Unit Converter' to include a comprehensive list of global units (Length, Weight, Temperature, Area, Volume, Speed, Time).
  * Add 'Typing Speed Test', 'Pomodoro Focus Timer', 'Event Countdown', 'Random Number Generator', and 'Format Converter (JSON/CSV/XML)'.
* **New Health & Lifestyle Workspace:** Create a section for 'BMI Calculator', 'Body Fat Calculator', 'Age & Date Calculator', 'Exam Age Eligibility', 'Menstrual & Ovulation Calculator', 'Mood & Daily Log', and 'Macro & Calorie Calculator'.
* **New Video Workspace:** Create a brand new, separate workspace dedicated entirely to **Video File Conversion** tools (MP4 to MP3, Video Compressor, Format Converter).

---
**CURSOR EXECUTION:** Always consult this file. Execute phase-by-phase. Do not move to a new section until the previous section is fully verified and deployed.