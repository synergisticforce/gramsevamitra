# GRAMSEVA MITRA - MASTER ARCHITECTURE & BLUEPRINT
**Status:** Active Execution File (The "Bible")
**Role:** This document is the ultimate source of truth for the Astro/Tailwind frontend, Cloudflare backend, UI/UX guidelines, Pro feature integration, and legal/basic pages. Cursor MUST read this file before executing any task to ensure absolute architectural consistency.

## 1. Core Platform Pages & Legal Infrastructure
Before the workspaces are built, the platform must have the following foundational pages routing correctly:
- **`/contact`:** Native serverless form powered by Cloudflare Pages Functions (`api/contact.js`), Resend API, and Cloudflare Turnstile (Already implemented). Do not overwrite with third-party form providers.
- **`/privacy` & `/terms`:** Legal standard pages detailing data handling. Must emphasize the offline-first privacy of free tools and the immediate auto-deletion policy of Pro serverless tasks.
- **`/disclaimer`:** Limitation of liability for financial/health calculators, legal templates, and AI-generated text.
- **`/404`:** A custom, branded error page with a search bar routing back to the homepage.
- **PWA Offline Fallback (`/offline`):** A cached page informing users they are offline, while indicating that most free tools (calculators, client-side PDF tasks) remain fully functional.

## 2. UI/UX Design System (Strict Rules)
- **Hyper-Minimalism:** We are building a 2026 Enterprise SaaS. No heavy drop shadows, no bright gradients. Use `shadcn/ui` components for base structural elements.
- **Mobile Navigation:** NEVER use thick edge-to-edge bottom bars or Floating Action Buttons (FABs). Use a "Floating Glassmorphism Pill" (`fixed bottom-6 inset-x-auto rounded-full backdrop-blur-md bg-white/80 border border-slate-200 shadow-lg`).
- **Desktop Navigation:** Strict 2-column layout. A Left Sidebar (`w-64 border-r bg-white`) and a Center Focus Canvas (`max-w-4xl mx-auto bg-slate-50`). NEVER use a 3-column layout.
- **Sub-navigation:** Replace horizontally scrolling chips or tabs with Apple-style Segmented Controls (`bg-slate-100 rounded-lg p-1`).
- **Quick Tools Drawer:** Triggered by `Cmd+K` on Desktop or the ⚡ icon on Mobile. Uses a blurred overlay command palette spanning the screen.

## 3. The Continuous Technology Upgrade Policy
The specific AI model versions listed below are the *current* state-of-the-art. Cursor must actively utilize the highest available stable version of these technologies at the time of implementation (e.g., if Llama 4 or Gemma 3 drops, use it instead of older versions). Open-weights models must be prioritized to run on serverless GPUs to eliminate recurring API costs.

## 4. Master Consolidation & Technology Matrix
**CRITICAL RULE:** All 83 existing tools MUST remain 100% free, operating entirely client-side. Serverless GPU/CPU models are strictly gated for Pro users.

| W# | Workspace | Free Tools (83 Existing + 4 Proposed) | Pro Features (Serverless GPU / Backend) | Technology Stack Mapping |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **File Converter & Data Studio** | 1. Straighten/Deskew, 2. Merge PDFs, 3. Split & Extract, 4. Remove Pages, 5. Rotate, 6. Reorder, 7. Page Numbers, 8. Watermark, 9. JPG>PDF, 10. PNG>PDF, 11. Word>PDF, 12. HEIC>PDF, 13. Type>PDF, 14. PDF>JPG, 15. PDF>PNG, 16. PDF>Text, 17. PDF>Word (Text only), 18. Organise, 19. Crop. | • Smart Document Extractor (to CSV/JSON)<br>• High-Fidelity DOCX (Layout preservation)<br>• Batch 50+ conversion<br>• Ebook conversion | **Free (Client):** `pdf-lib`, `pdf.js`, **`tesseract.js`** (Offline OCR), `mammoth.js`.<br>**Pro (Serverless):** **PaddleOCR** (Text/Tables), **GLM-4V/Qwen2-VL** (Layout/Vision), **Google Cloud Vision API** (Failsafe for unsupported languages), **LibreOffice Headless**, **`pdf2htmlEX`**, **Calibre**. |
| **2** | **Writing & Document Studio** | 20. Smart Writing Studio (includes rich text, word count, Speech-to-Text, Text-to-Speech, basic grammar checking). | • AI Summarize / Translate<br>• AI Rewrite / Improve Style<br>• High-accuracy Audio/Video Transcription. | **Free (Client):** `Compromise.js`, Canvas API, Web Speech API.<br>**Pro (Serverless):** **Gemma 2 / Llama 3.x** (Latest LLM), **LanguageTool** (Advanced grammar server), **Whisper** (`faster-whisper`). |
| **3** | **Image Studio** | 21. Govt Exam Optimizer, 22. Photo to Scanned PDF, 23. Exam Photo & Signature Studio, *24. Image Metadata Viewer/Remover (Proposed).* | • AI Background Removal<br>• AI Photo Restoration (Old/Damaged)<br>• AI Image Upscale (2x/4x) | **Free (Client):** `browser-image-compression`, HTML5 Canvas.<br>**Pro (Serverless):** **BRIA RMBG-1.4**, **Real-ESRGAN**, **GFPGAN**. |
| **4** | **PDF Compression Hub** | 25. Compress PDF Size (Quality slider, grayscale toggle). | • Advanced exact KB compression<br>• Lossless re-encoding<br>• Web Linearize | **Free (Client):** `pdf-lib` (Object removal).<br>**Pro (Serverless):** **Ghostscript**, `libjxl`, `libavif`. |
| **5** | **Document Security** | 26. Repair Corrupt PDF, 27. Strip PDF Metadata, 28. Sign PDF (Draw/Type), 29. Unlock PDF, 30. Protect PDF, 31. Secure Document Redactor. | • Digital Signature Verification<br>• Virus/Malware Scan<br>• PDF/A Compliance Validation | **Free (Client):** `pdf-lib` (AES encryption).<br>**Pro (Serverless):** **OpenSSL**, **ClamAV**, **veraPDF**. |
| **6** | **Career Prep Room** | 32. ATS Scanner, 33. Job Tracker, 34. Salary Calc, 35. Cold Email Builder, 36. Biz Card Gen, 37. Salary Benchmarking, 38. Skill Gap, 39. Legal Templates, 40. Typing Test, 41. ATS Keyword Matcher. | • AI Resume Rewriter (ATS Optimization)<br>• AI Cover Letter Generator | **Free (Client):** `pdf.js` (text parsing), Regex logic.<br>**Pro (Serverless):** **Gemma 2 / Llama 3.x**. |
| **7** | **Financial & Gig Hub** | 42. EMI Calc, 43. SIP Calc, 44. GST Calc, 45. Discount Calc, 46. Loan Repay, 47. Tip/Cost Splitter, 48. Multi-currency/Time Zone, 49. Invoice Builder, 50. Pay Stub, 51. Meeting Cost, 52. Tax Tracker, 53. Crypto Gains, 54. Gig Income, 55. Envelope Budget. | *(Indirect Pro routing: Users seamlessly routed to W1 for AI Bank Statement Extraction).* | **Free (Client):** Vanilla JS, `Chart.js`, `Frankfurter API`. |
| **8** | **Health & Life** | 56. Pomodoro, 57. Event Countdown, 58. BMI Calc, 59. Body Fat Calc, 60. Age Calc, 61. Exam Age Eligibility, 62. Menstrual Calc, 63. Mood Log, 64. Macro Calc. | *(No direct Pro overlap).* | **Free (Client):** Vanilla JS, `localStorage`. |
| **9** | **Quick Tools Drawer** | 65. QR Code, 66. Unit Converter, 67. Percentage, 68. Scientific Calc, 69. Password Gen, 70. Random Number, 71. Base64, 72. URL Encode, 73. Hash Gen, 74. Format/Code Beautifier, 75. Color Palette, 76. Baby Name, 77. Decision Wheel, 78. SEO Meta, 79. Recipe Scaler, 80. Pet Feeding, 81. Gardening, 82. Construction Est, 83. Home Renovation, *84. Local DB (Proposed)*, *85. Offline Map (Proposed).* | *(No direct Pro overlap).* | **Free (Client):** Vanilla JS, Web Crypto API. |
| **10**| **Pro Tools Hub** | *(Premium only. No free tools map here.)* | • Video Compressor (MP4 to H.265)<br>• AI Diagram Gen (Text-to-Flowchart) | **Pro (Serverless):** **FFmpeg**, **Mermaid.js** + **LLM**. |

## 5. The Tri-Engine Data Extraction Pipeline (Smart Router Logic)
When processing image PDFs in Workspace 1, the Cloudflare Worker MUST act as a "Smart Router" to prevent compute waste, executing in this exact order:
1. **Scenario A (Data to CSV/JSON):** If user requests structured data (Invoice/Bank Statement), route image directly to **GLM-4V** (Vision-Language Model) for single-pass extraction.
2. **Scenario B (Image to High-Fidelity DOCX):** Route image to **PaddleOCR** for rapid bounding-box text extraction. Pass the bounding boxes to **GLM-4V** to map the layout hierarchy (headers vs tables). Pass the hierarchy to **LibreOffice Headless** to render the final DOCX.
3. **The Failsafe:** If PaddleOCR or GLM-4V encounters a low-confidence region or an unsupported regional language, the router intercepts and sends the failed block to the **Google Cloud Vision API** to guarantee accurate output.

## 6. Phased Implementation Protocol
Cursor must execute tasks strictly in this sequence. Do not proceed to the next phase until the current phase is fully functional and committed.

* **Phase 1: The Plumbing (Identity & Database)**
    * Set up `Cloudflare D1` (`users` table: id, email, plan, credits).
    * Initialize `Better Auth` for Google OAuth and session management.
* **Phase 2: The Global UI Shell (Front-End Foundation)**
    * Build `SaaSLayout.astro` (Desktop Sidebar, Mobile Floating Glass Pill, Segmented Controls).
    * Build the `Cmd+K` Omni-Search palette for the Quick Tools Drawer.
    * Ensure the static core pages (Privacy, ToS, Disclaimer, 404, Offline, Contact) are correctly routed within the new layout.
* **Phase 3: The Hybrid Workspace Migration (Preserving SEO)**
    * Migrate the 83 existing tools into Workspaces 1-9.
    * **CRITICAL:** Ensure all 83 existing URLs remain exactly the same. The `SaaSLayout` wraps the content; the routes do not change.
* **Phase 4: Monetization & Serverless GPU Integration**
    * Integrate Razorpay/Stripe (Test Mode only).
    * Set up Webhooks to update the `plan` column in Cloudflare D1.
    * Build the Cloudflare Worker "Smart Router" and connect to serverless GPU instances (Modal/Hugging Face).
    * Implement the multi-stage loading UI for Pro tasks (e.g., "Waking up AI engine...").