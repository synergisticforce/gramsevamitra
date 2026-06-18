# GRAMSEVA MITRA - MASTER DEVELOPMENT PLAN & CONSTRAINTS

**CRITICAL DIRECTIVE FOR CURSOR:** You are assisting a non-technical founder. Read, understand, and strictly adhere to this document before executing ANY code changes. Write robust, error-handled, production-ready code. 

## 1. UI/UX & Visibility Rules (Phase 1 - Completed)
* **Dark Mode Contrast:** Maintain high-contrast Tailwind classes (`text-slate-200`, `text-white`) across all `bg-canvas-surface` elements.
* **Workspace Cleanliness:** Standalone tools remain visible. "Related/Dependent" tools must be hidden from the default view and only reveal themselves *after* a user successfully uploads a document.
* **Loading States:** Every tool must use global "Processing... Please wait" spinners during tasks.

## 2. The "No Size Limit" Chunking Architecture (Phase 2 - Active)
* **The Absolute Rule:** FILE SIZE IS NEVER LINKED TO THE PRO PLAN. Free users can upload and process files of ANY size (including 5GB+ files) using Free tools without ever hitting a paywall.
* **The Architecture:** Implement the background "Smart Slicing Pipeline" using 20MB chunks. If a file exceeds safe local browser memory (~50MB), automatically slice it, stream it to our Cloudflare backend for FREE processing piece-by-piece, and merge the final output back to the user. 
* **Storage Constraint:** Use `PRO_TRANSIENT` R2 bucket for temporary staging during chunking. The Worker MUST delete chunks immediately after the final file is streamed to prevent storage costs.

## 3. Advanced OCR Architecture & Fallbacks (Phase 3)
Implement a tiered, fail-safe OCR engine system:
* **Tier 1 (Free / Local):** Default to `Tesseract.js` for free browser-based extraction.
* **Tier 2 (Pro / Serverless GPU):** If Tier 1 explicitly fails (e.g., blurry scan, unreadable text), OR if the user manually selects a Pro extraction tool, route to a Serverless GPU. Use **Paddle OCR/GLM OCR** (primary) or **Google Cloud Vision** (fallback).

## 4. Platform Housekeeping & Pro Upsell Logic
* **Strict Pro Trigger:** Pro plans should ONLY be suggested if:
  1. The user explicitly clicks a premium tool marked with a `[PRO]` badge.
  2. A Free tool technically fails to complete a task (e.g., basic OCR fails) and a Pro tool is required to succeed. 
* **Contact:** All support channels must strictly use `support@gramsevamitra.com`.

## 5. Workspace Expansion & Tool Injections
* **Document Studio:** Build 'Organise PDF Pages' (Drag & Drop), 'Repair Corrupt PDF', 'Photo to Scanned PDF', 'Strip PDF Metadata', 'Sign PDF', and 'Secure Document Redactor'.
* **Quick Tools:** Expand the 'Unit Converter' globally. Add 'Typing Speed Test', 'Pomodoro Focus Timer', 'Event Countdown', 'Random Number Generator', and 'Format Converter (JSON/CSV/XML)'.
* **New Health & Lifestyle Workspace:** Build 'BMI Calculator', 'Body Fat Calculator', 'Age & Date Calculator', 'Exam Age Eligibility', 'Menstrual & Ovulation Calculator', 'Mood & Daily Log', and 'Macro & Calorie Calculator'.
* **New Video Workspace:** Build a dedicated workspace for Video File Conversion tools.