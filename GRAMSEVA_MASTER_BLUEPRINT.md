# GRAMSEVA MITRA: MASTER ARCHITECTURE & EXECUTION BIBLE
**Version:** 1.0 (LOCKED)
**Directive:** Cursor MUST read and adhere to this document before executing any code generation, refactoring, or architectural changes.

## 1. CORE BUSINESS PHILOSOPHY & MANDATES
GramSeva Mitra is an enterprise-grade platform offering 80+ tools. To ensure sustainability and autonomous operation, the system strictly adheres to the following mandates:
* **The Zero-Cost Mandate:** Server operations must NEVER scale with user volume unless funded by a Pro transaction. Free tier tools must run 100% on the client side.
* **The Cognitive Rule ("Don't Make Users Think"):** Users do not navigate a maze of 83 tools. They use the "Omni-Router Magic Dropzone." The system adapts to the file, asks for intent, and routes accordingly.
* **The Profit Shield (₹99 Annual Anchor):** Pro users pay ₹99/year. This grants a strict Fair Usage Policy (FUP) of AI Credits (e.g., 30 credits/month). Operations that hit cloud GPUs or APIs deduct credits to mathematically guarantee server costs never exceed revenue.

---

## 2. THE OMNI-ROUTER PIPELINE (THE FRONT DOOR)
All file processing is handled through the central `OmniDropzone` component using the "Waterfall Method":
1. **Blind Drop (Metadata Extraction):** User drops a file (`.pdf`, `.jpeg`, `.mp4`, `.xlsx`, etc.). The browser instantly reads the MIME type, size, and page count/duration locally without uploading.
2. **Intent Engine:** UI asks the user what they want to do based on the file type (e.g., "Compress", "Summarize", "Merge").
3. **Quoting System:** The system routes the request to the cheapest capable tier. If Tier 1, it displays "Instant & Free." If Tier 2 or 3, it displays the exact AI Credit cost upfront.
4. **Execution:** File is processed, chunked if necessary, and returned.

---

## 3. THE LOCKED 3-TIER TECHNOLOGY STACK
The system routes tasks strictly through these three tiers to maximize efficiency and minimize cost.

### TIER 1: The Zero-Cost Engine (Client-Side / Free Tier)
*Executes entirely within the user's browser (RAM/CPU). Cost: ₹0.00.*
* **PDFs:** `Ghostscript` (WASM for hardcore compression), `pdf-lib` (Merge/Split), `pdf.js` (Silent text extraction).
* **Media:** `ffmpeg.wasm` (Video/Audio offline compression/conversion), `browser-image-compression`, `svgo`, `mozjpeg-wasm` (Image optimization).
* **Documents & Data:** `SheetJS` (Excel/XLSX), `mammoth.js` & `docx` (Word/DOCX), `fflate` & `JSZip` (Folder/Zip archiving).
* **Offline Vision/AI:** `Tesseract.js` (Offline OCR), `Whisper.wasm` (Offline audio transcription), `Segment Anything Model (SAM-Web)` & `OpenCV.js` (Background removal/Edge scanning).
* **Logic/Visuals:** `Transformers.js` (Offline LLM/sentiment), `Mermaid.js` (Diagrams), `Chart.js` (Graphs).

### TIER 2: High-Efficiency Cloud (Pro Tier / 1–3 AI Credits)
*Executes on Cloudflare Edge & Serverless GPUs. Highly economical.*
* **Text/Logic:** `Gemma 2` & `Llama 3 8B` (via Cloudflare Workers AI) for summarization, resume writing, and data formatting.
* **Vision/Extraction:** `GLM OCR`, `Paddle OCR`, `Surya OCR / Marker` for complex layouts, nested tables, and mixed-language PDFs. `YOLOv10` for object detection.
* **Image Editing:** `Stable Diffusion (SDXL)`, `RMBG-1.4` (Backgrounds), `CodeFormer` (Facial restoration) via serverless GPU providers (e.g., Replicate/Groq).

### TIER 3: Ultra-Premium Fallback (Pro Tier / 5+ AI Credits)
*Executes on proprietary corporate APIs. Used strictly as a last resort.*
* **Extreme Edge-Case OCR:** `Google Cloud Vision (GCV)` for illegible Indian regional handwriting (Hindi, Bengali) or blurry government IDs.
* **Complex Math/Reasoning:** `Anthropic Claude 3.5 Sonnet` (for explaining complex visual charts) and `Mathpix` (for handwritten LaTeX/math equations).

---

## 4. FOOLPROOF PROTECTIONS & LOOPHOLE CLOSURES
* **The RAM Shield (Client-Side Chunking):** Cloudflare Workers have 128MB RAM. If a user uploads a 2GB PDF for Pro AI extraction, the browser MUST use `pdf-lib` to chop the file into 5MB chunks client-side, uploading them sequentially to prevent server crashes.
* **The AI Token Shield (Local Pre-Extraction):** Before sending a PDF to an LLM, `pdf.js` extracts the pure text. We send KB of text, not MB of images, saving massive AI token costs.
* **The Stability Shield (React Error Boundaries):** Wrap the App Shell and Omni-Router in a `GlobalErrorBoundary`. If WASM crashes an old device due to RAM limits, display a graceful fallback UI ("Something went wrong. Please refresh").

---

## 5. PHASED EXECUTION ROADMAP
Cursor must execute future development strictly in these phases:

* **PHASE 1: Omni-Router Foundation:** Build `OmniDropzone.tsx`. Implement client-side metadata extraction (MIME type, size parsing) and the UI Intent/Quoting engine.
* **PHASE 2: Tier 1 Engine Wiring:** Connect the existing 83 client-side tools (and integrate the new WASM dependencies like `Ghostscript` and `ffmpeg.wasm`) into the Omni-Router.
* **PHASE 3: Tier 2 & 3 Cloud Integration:** Build the edge functions (`/api/pro/...`) for Gemma 2, Paddle OCR, and GCV. Implement the client-side chunking logic and AI Credit deduction middleware via Cloudflare D1.
* **PHASE 4: Day-Zero Ops:** Finalize Razorpay Live webhook testing, activate Cloudflare Web Analytics, and verify the production database schema.