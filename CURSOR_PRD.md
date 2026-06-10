# 🏛️ PROJECT VISION & ARCHITECTURE: GramSeva Mitra Utilities Hub

## 1. Project Overview
Act as a Principal Frontend Engineer and UX Architect. We are building the `gramsevamitra.com/tools` sub-directory. It is a "Super-App" style utility hub designed for rural Indian students, job seekers, and gig workers. 

## 2. Core Rules (NON-NEGOTIABLE)
1. **Zero-Cost, Client-Side ONLY:** You are strictly forbidden from writing code that requires a backend server, external paid APIs, or database. Everything must run in the browser using DOM APIs, Canvas, `localStorage`, and free NPM packages.
2. **Hybrid App Shell (SEO + Speed):** Do not hide tools inside generic modals on the index page. Every tool MUST have its own dedicated Astro route (e.g., `/tools/money/emi-calculator`) for SEO ranking. 
3. **App-Like Feel:** Use Astro `<ViewTransitions />` in the global layout so navigating between these distinct routes feels like an instant native app transition without white-screen flashes.
4. **Anti-Overwhelm UI:** The UI must be highly consolidated. Tools are grouped into 5 specific Workspaces.
5. **Data Persistence:** Use `localStorage` extensively so user data (habits, ledgers, text drafts) survives page refreshes.

## 3. Tech Stack
- **Framework:** Astro.js (SSG mode)
- **Styling:** Tailwind CSS
- **Interactivity:** Vanilla JS/TS (inside Astro `<script>` tags) or lightweight client-side frameworks if explicitly requested.
- **Deployment:** Cloudflare Pages

## 4. UI/UX Layout Structure
Every page within `/tools/*` must use a unified `ToolsLayout.astro` wrapper containing:
- **Global Header:** `[GramSeva Mitra Logo] | [Back to PDF Hub ➔]` (Link back to main domain).
- **Sticky Smart Search:** An auto-suggest search bar that links directly to specific tool routes.
- **Main Content Area:** `<slot />` where the workspace or tool renders.
- **Bottom Navigation (Mobile):** Icons for [🏠 Home] [💰 Money] [✍️ Write] [🚀 Career] [🧰 Quick].

## 5. The 5 Master Workspaces & Complete Tool Roster
You must account for EVERY tool listed below. Do not skip any.

### 🏦 Workspace 1: Money & Gig Ledger (`/tools/money/*`)
*Dashboard UI with tabs for ledgers and a grid for quick calculators.*
- `index.astro` (The Dashboard: Gig Worker Daily Income Tracker, Envelope Budget Planner, Vehicle Fuel Efficiency Tracker, Subscription Cost Analyzer)
- `emi-calculator.astro`
- `loan-repayment.astro`
- `tip-calculator.astro`
- `multi-currency.astro` (Static offline rates)
- `invoice-builder.astro` (Outputs PDF via client-side library)
- `pay-stub-generator.astro`
- `meeting-cost.astro`
- `tax-deduction-tracker.astro`
- `crypto-tax.astro` (Simple capital gains)

### ✍️ Workspace 2: Smart Writing Studio (`/tools/writing/*`)
*Distraction-free text editor UI with floating toolbars and side-panels.*
- `index.astro` (The Editor: Markdown Editor with Live Word/Character Count and Readability Score)
- `handwriting-converter.astro` (Text to handwritten image export)
- `speech-to-text.astro` (Web Speech API)
- `text-to-speech.astro` (SpeechSynthesis API)
- `citation-generator.astro` (APA/MLA/Chicago)
- `plagiarism-checker.astro` (Client-side text diff/comparison)
- `gpa-calculator.astro`
- `flashcard-maker.astro` (Highlight text -> save to local deck)
- `mindmap-builder.astro` (Visual canvas)
- `phonetic-alphabet.astro` (IPA converter)

### 🚀 Workspace 3: Career Prep Room (`/tools/career/*`)
*Step-by-step wizard UI flowing into a Kanban board.*
- `index.astro` (Resume Bullet Rewriter using STAR method -> LinkedIn Optimizer -> Cover Letter Generator)
- `job-tracker.astro` (Offline Kanban board for applications)
- `business-card.astro` (vCard generator)
- `salary-benchmarking.astro` (Static data lookup)
- `skill-gap.astro`
- `legal-templates.astro` (Fill-in-the-blank static PDFs: NDAs, Rental Agreements)

### 🧘 Workspace 4: Life & Focus Tracker (`/tools/life/*`)
*Daily dashboard resetting every 24 hours via localStorage.*
- `index.astro` (Pomodoro Timer + Daily Stretching Timer + Habit Tracker Checklist + Water Intake + Medication Reminder)
- `event-countdown.astro` (Exam/Birthday countdowns)
- `bmi-calculator.astro`
- `body-fat.astro`
- `menstrual-tracker.astro` (Strictly private/offline)
- `mood-tracker.astro`

### 🧰 Workspace 5: Quick Tools Drawer (`/tools/quick/*`)
*A simple, searchable grid of fast, single-action utilities.*
- `qr-generator.astro`
- `unit-converter.astro`
- `password-generator.astro`
- `format-converter.astro` (CSV/JSON/XML)
- `color-palette.astro`
- `baby-names.astro`
- `decision-wheel.astro`
- `seo-meta-tags.astro`
- `recipe-scaler.astro`
- `pet-feeding.astro`
- `gardening-planner.astro`
- `construction-materials.astro`
- `home-renovation.astro`

## 6. Execution Protocol for Cursor
Do NOT build everything at once. We will execute in strict phases:
- **Phase 1:** Scaffold the `ToolsLayout.astro` (with ViewTransitions), the Global Header, the Smart Search component, and the `tools/index.astro` homepage.
- **Phase 2:** Scaffold the empty directory structure and base routes for all 5 Workspaces.
- **Phase 3+:** I will explicitly command you to build tools one workspace at a time (e.g., "Let's build the `emi-calculator.astro` today").