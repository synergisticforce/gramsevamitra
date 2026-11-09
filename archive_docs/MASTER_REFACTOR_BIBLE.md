# GRAMSEVA MITRA: MASTER PLATFORM SYNCHRONIZATION BIBLE

**CRITICAL DIRECTIVE FOR CURSOR:** This document serves as the absolute source of truth for standardizing the GramSeva Mitra application. Execute these phases synchronously when instructed. Ensure strict adherence to our dark mode UI (`text-slate-200`, `bg-canvas-surface`) and local client-side processing rules.

## PHASE 1: "To Editable Format" Heuristics & Expansion Patch
**Objective:** Fix format routing loopholes, bypass unnecessary paywalls, and expand output options in Document Studio.
1. **Expand Formats:** Update the `ToEditableFormatPanel` segmented control to include: `[.txt]`, `[.md]`, `[.docx]`, `[.xlsx - PRO]`, `[.csv - PRO]`, `[.xml - PRO]`.
2. **Fix the .txt/.md Paywall Loophole (`toEditableFormatPipeline.ts`):**
   - If the user selects `.txt` or `.md` (which are raw text formats lacking layout), **bypass** the `COMPLEX_LAYOUT` Pro trigger completely. Extract the raw text stream locally and deliver the file instantly for free, regardless of how complex the PDF structure is.
3. **Update Pro Routing Gates:**
   - `.xlsx`, `.csv`, and `.xml` ALWAYS trigger the Pro Server endpoint (requires structural matrix compilation).
   - `.docx` triggers Pro ONLY if `COMPLEX_LAYOUT` is true OR if `Tesseract.js` confidence drops < 65%.

## PHASE 2: Global Workspace UI/UX Synchronization & Jargon Cleanup
**Objective:** Standardize empty states across all media workspaces and remove confusing developer terminology.
1. **Video Studio & Image Studio Layouts:** 
   - Refactor `VideoHubCanvas` and `ImageHubCanvas` to match Document Studio's behavior. 
   - On initial load, show ONLY the main file upload dropzone. Hide the tool grid entirely to prevent choice paralysis.
   - Upon file drop, shrink the dropzone to a top summary bar and reveal the tool grid below it.
2. **Remove Technical Jargon:**
   - Thoroughly scan the Video Studio workspace UI components (`VideoHubCanvas`, `VideoToolGrid`, tool descriptions, and footers). 
   - Completely remove all mentions of `FFmpeg.wasm`, `FFmpeg`, and `WASM`. 
   - Replace technical phrasing with clean user copy (e.g., change "Five FFmpeg.wasm tools" to "Five Video Tools", and "processed locally via WASM" to "processed privately on your device").
3. **Sidebar Reordering:** In `AppSidebar.tsx` and layout registries, move Career Prep one slot up. The new strict order: Document Studio > Image Studio > Video Studio > Career Prep > Health & Lifestyle > Finance Hub > Quick Tools.

## PHASE 3: Career Prep Logic & Tool Migration
**Objective:** Clean up Career Prep so it operates strictly as a document-first workspace.
1. **Migrate Non-Document Tools:**
   - Move `Salary Calc` and `Salary Benchmarking` to the **Finance Hub**.
   - Move `Job Tracker` and `Cold Email Builder` to **Quick Tools** (under a new "Career" or "Productivity" category).
2. **Career Prep Empty State:**
   - Implement the "Dropzone First, Grid Hidden" layout.
   - The dropzone text should read: "Drop your Resume or Cover Letter here".
   - Only reveal the tool grid once a document is uploaded. Remaining tools must act strictly on the uploaded document (e.g., ATS Scanner, Resume Tailor, Cover Letter Builder).

## PHASE 4: Media Tool Expansion (Client-Side)
**Objective:** Flesh out the missing essential tools in the media workspaces.
1. **Add to Image Studio:**
   - Image Cropper (interactive UI canvas).
   - Watermark Image (text/logo overlay).
   - Image to PDF Converter.
   - Filter Suite (Grayscale, Black & White Threshold).
2. **Add to Video Studio (Local Processing):**
   - Trim/Cut Video (Select Start/End times).
   - Add Watermark to Video.
   - Change Video Speed (0.5x, 1.5x, 2.0x).
   - Extract Frame (Slider to pick a specific second, export as JPG).
3. **App Registry:** Ensure all newly created tools are registered in their respective `canvasTools.ts` registries so the global app model audits reflect them.

**Execution Command:** Acknowledge this master plan. Do not execute all phases at once. I will explicitly instruct you to execute a specific phase (e.g., "Execute Phase 1").