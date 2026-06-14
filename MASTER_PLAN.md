# GramSeva Mitra - Master App Architecture & Tech Stack Plan (Unified Canvas)

## 1. Project Objective
Transition GramSeva Mitra from a static "Tool Directory" into a modern, unified "App Model" SaaS platform. The goal is to maximize user retention and organic upsells to the ₹199/month Pro tier by seamlessly integrating free tools and premium serverless features within a persistent, high-performance UI shell.

## 2. Core Technology Stack (Immutable)
* **Frontend Framework:** Astro (Static Site Generation / SSR) + React (for interactive client-side Canvas components) + Tailwind CSS.
* **Authentication:** Better Auth (Google OAuth).
* **Database:** Cloudflare D1 (SQLite at the Edge).
* **Backend Compute:** Cloudflare Pages Functions & Workers (V8 Edge runtime, NOT Node.js).
* **Payment Gateway:** Razorpay (Checkout.js on frontend, Web Crypto HMAC verification on backend).
* **Hosting:** Cloudflare Pages.

## 3. UI/UX Architecture (The 4 Core Components)
The interface abandons traditional web pages in favor of a dynamic application state.
* **Component A (The Persistent Shell):** A locked left sidebar (Desktop) or Hamburger menu (Mobile). Controls navigation across the 5 workspaces without page reloads.
* **Component B (The Magic Dropzone):** The default empty state of a workspace. A central drag-and-drop area (or tap-to-upload on mobile) that accepts user files and holds them in local browser memory.
* **Component C (Contextual Action Toolbars):** Replaces the Dropzone once a file is loaded. Displays actionable buttons relevant *only* to the file's MIME type (e.g., PDF tools for PDFs).
* **Component D (The Monetization Layer):** Pro tools are marked with a `⚡ Pro` badge inside the toolbars. Clicking them intercepts the action, checks the D1 `plan` status, and triggers the `ProUpgradeModal` (Razorpay) inline for free users.

## 4. The 5 Core Workspaces (Consolidation)
All 83 legacy micro-tools will be absorbed into these 5 dynamic canvases:
1. **`/workspace/documents` (Document Studio):** File manipulation. (Merge, Split, Compress, Protect, Smart Extract).
2. **`/workspace/media` (Media Lab):** Image optimization. (Exam Photo Resizer, Format Conversion, AI Background Removal).
3. **`/workspace/career` (Career Prep):** Text & Layout parsing. (ATS Scanner, AI Resume Rewriter).
4. **`/workspace/finance` (Finance Hub):** Mathematical canvases. (EMI, GST, Invoice Builders).
5. **`/workspace/quick-tools` (Quick Tools):** Transient utilities. (Calculators, Generators).

## 5. Security, Performance & Loophole Mitigations (Must Implement)
1. **Mobile Interactions:** Drag-and-drop is unreliable on mobile. Components must conditionally render a large "Tap to Upload" native file picker button on viewports `< 768px`.
2. **State Preservation:** Implement `SessionStorage` for active canvases. If a user accidentally refreshes the page, the UI must reload the last known file configuration to prevent data loss.
3. **Code Splitting (Dynamic Imports):** To prevent 10-second load times, heavy client-side engines (like `pdf-lib` or `browser-image-compression`) must ONLY be downloaded when the user actively enters that specific workspace.
4. **Transient Pro Storage:** Files uploaded for Pro serverless GPU processing must go to a temporary Cloudflare R2 bucket with a strict 1-hour lifecycle deletion rule.
5. **GPU Rate Limiting:** Apply Cloudflare Rate Limiting to all `/api/pro/*` endpoints to prevent abuse of expensive serverless AI tasks.

## 6. Execution Roadmap (Strict Sequence)
* **Phase 1 (The App Shell Refactor):** Delete legacy static directory pages. Build the persistent left sidebar, the 5 empty Astro/React page routes, and update the Better Auth redirect to `/workspace/documents`.
* **Phase 2 (The Canvas MVP):** Build the Magic Dropzone and Contextual Toolbars UI for `/workspace/documents`.
* **Phase 3 (Monetization Wiring):** Connect the `⚡ Pro` buttons on the Action Toolbar to the D1 context and Razorpay `ProUpgradeModal`.
* **Phase 4+ (Tool Migration):** Iteratively port the exact processing logic for all 83 legacy tools into the new context-aware toolbars.