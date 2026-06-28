# Architecture Rules — Technical Guide for AI Assistants

**Purpose:** Hard constraints and conventions any AI working on the GramSeva Mitra codebase must follow. When in doubt, these rules override general coding habits.

---

## 1. Non-Negotiable Platform Rules

### Client-first, zero-upload-by-default

> **Always use the client-first, zero-upload-by-default architecture.**

- Intense operations (PDF manipulation, image optimisation, OCR, video processing, text analysis) must run **in the browser** via Web Workers, WASM, and the Canvas API wherever possible.
- User files must **not** leave the device unless the user explicitly opts into a Pro/server pipeline that requires it.
- Server involvement is limited to: authentication, billing, Pro AI reconstruction, Smart Slicing for oversized files, and **transient** R2 staging with automatic deletion.
- When writing new tools, ask: *"Can this run entirely on-device?"* If yes, it must.

### Never use FlutterFlow

> **Never use `flutterflow`.**

- GramSeva Mitra is an **Astro 4 + React 18** monorepo with Tailwind CSS — not a FlutterFlow or Flutter project.
- Do not introduce FlutterFlow exports, dependencies, patterns, or migration paths.
- Do not suggest FlutterFlow as a prototyping or deployment shortcut.

### Secrets and environment variables

> **Never hardcode secrets; always use Cloudflare Pages Environment Variables.**

- API keys (Razorpay, Resend, Google OAuth, Turnstile, Workers AI, etc.) belong in **Cloudflare Pages encrypted secrets** — Production and Preview environments.
- Never commit `.env`, credentials, tokens, or webhook secrets to the repository.
- Client-exposed values use the `PUBLIC_` prefix (e.g., `PUBLIC_RAZORPAY_KEY_ID`). Server-only values have no prefix.
- Reference `LAUNCH_CHECKLIST.md` and `cloudflare/DEPLOYMENT.md` for the canonical secret inventory.

### Prompt and documentation format

> **Always provide prompts in Markdown format.**

- AI prompts, system instructions, user-facing copy drafts, and knowledge-base entries must be written as **valid Markdown** (headings, lists, tables where helpful).
- Do not deliver prompts as plain unformatted walls of text or proprietary binary formats.
- WIKI entries in `.gramseva_knowledge/WIKI/` follow this rule.

---

## 2. Repository Structure

```
GramsevaMitra/
├── apps/hub/              # Main Astro + React application (production UI)
├── packages/shared/       # Shared utilities and components
├── packages/auth/         # Better Auth client/server helpers
├── functions/             # Cloudflare Pages Functions (edge API)
├── wrangler.toml          # Cloudflare bindings (D1, R2, etc.)
├── .gramseva_knowledge/   # AI memory: WIKI, RAW, OUTPUTS
└── .stale_archive/        # Retired components — do not resurrect without review
```

**Monorepo:** npm workspaces. Build and deploy from the **repository root** so `/functions` bindings apply.

---

## 3. Frontend Stack and Conventions

| Layer | Technology |
|-------|------------|
| Framework | Astro 4.x (SSG/routing) + React 18 islands |
| Styling | Tailwind CSS 3.x — **mobile-first always** |
| State | React `useState` / `useRef`; workspace persistence via `localStorage` modules |
| Heavy libs | Dynamic `import()` only — never static-import pdf.js, Tesseract, FFmpeg at top level |

### Lead Engineer standards (`.cursorrules`)

- Write **complete, robust, production-ready code** — no placeholders or TODO stubs shipped as features.
- Prefer **zero-dependency browser-side libraries** for instant load on rural 3G/4G.
- All UI must be **mobile-first** via Tailwind breakpoints.

### Processing discipline

- `isProcessing` / `loading` states default to **`false`**.
- Long-running work starts only on **explicit user action** (button click, file selection) — never on mount.
- Use Web Workers for PDF (`pdfCanvas.worker.ts`) and OCR (`tesseractOcr.worker.ts`) to keep the main thread responsive.

---

## 4. Production App Model — Seven Workspaces

Production UI lives under `/workspace/*`, not legacy `/tools/*` routes.

| ID | Label | Canvas component |
|----|-------|------------------|
| `documents` | Document Studio | `DocumentStudioCanvas.tsx` |
| `image` | Image Studio | `MediaStudioCanvas.tsx` |
| `video` | Video Studio | `VideoStudioCanvas.tsx` |
| `lifestyle` | Lifestyle Hub | `LifestyleCanvas.tsx` |
| `career` | Career Prep Room | `CareerCanvas.tsx` |
| `finance` | Money & Gig Ledger | `FinanceCanvas.tsx` |
| `quick-tools` | Quick Tools | `QuickToolsCanvas.tsx` |

**Source of truth:** `apps/hub/src/config/appWorkspaces.ts`

Each workspace has its own action/tool registries (`*CanvasActions.ts`, `*CanvasTools.ts`). New tools must register in the correct workspace registry — not as orphaned standalone pages.

---

## 5. Client-Side Processing Boundaries

### Device-aware limits

| Context | Mobile / tablet | Desktop |
|---------|-----------------|---------|
| Local PDF processing | 50 MB | 1 GB |
| Max upload | 1 GB | 2 GB |
| Local video (FFmpeg.wasm) | 250 MB | 2 GB |

Detection: `apps/hub/src/lib/pdf/deviceDetection.ts`

### Smart Slicing (server fallback)

When a file exceeds local limits, modals may call `/api/chunked/*` — 20 MB chunks to transient R2, server-side processing, automatic cleanup via `context.waitUntil`.

**Exceptions (no Smart Slicing — block if over limit):** Deskew/Straighten, PDF → JPG/PNG (require browser canvas).

### Memory hygiene

- Stream files to workers in **2 MB chunks**; zero chunk arrays after assembly.
- Call `yieldToGc()` between heavy page loops.
- Tesseract: prefer `runTesseractWithMemoryFlush` (fresh worker per job) for To Editable Format pipelines.
- FFmpeg: clean virtual FS after each job; revoke blob URLs after download.

---

## 6. Backend (Cloudflare Edge)

| Service | Usage |
|---------|-------|
| **Cloudflare Pages** | Static hosting + Functions |
| **D1 (SQLite)** | User identity, plan, credits |
| **R2 (`PRO_TRANSIENT`)** | Ephemeral Pro uploads — 1-hour lifecycle |
| **Workers AI** | Pro text/layout reconstruction (Gemma, Llama) |
| **Better Auth** | Google OAuth + email OTP |

**Runtime:** Cloudflare Pages Functions run on the **V8 edge runtime** — not Node.js. Do not use Node-only APIs (`fs`, `child_process`, native modules) in `/functions`.

**Rate limiting:** All `/api/pro/*` endpoints must be edge-rate-limited.

---

## 7. Auth, Billing, and Pro Features

- **Auth:** Better Auth via `packages/auth` — Google OAuth and email OTP.
- **Payments:** Razorpay — webhook signature verification required before updating D1 plan/credits.
- **Pro pipelines:** OCR waterfall (Paddle → GLM → Google Vision), layout reconstruction, structural exports (XLSX/CSV/XML).
- **Credit checks:** Use `creditCheck.ts` and `useProCreditConfirm` hook before deducting credits.

Pro upgrades must never block free-tier core utilities.

---

## 8. Cross-Subdomain Navigation

The monorepo deploys across subdomains. Links that exit a sub-app or return to the root dashboard **must** use `data-astro-reload` to avoid broken ViewTransitions routing.

---

## 9. CI, Typecheck, and Deployment

- **CI:** GitHub Actions runs `npm run typecheck` then build/deploy.
- **Typecheck:** `apps/hub/tsconfig.json` — strict Astro config with `skipLibCheck: true`.
- **Deploy:** Push to `main` → Cloudflare Pages auto-deploy via GitHub webhook.
- **Health check:** Run `python3 .gramseva_knowledge/auto_health_check.py` to audit the AI memory folders.

---

## 10. AI Memory System

```
.gramseva_knowledge/
├── WIKI/       ← Curated operational rules (this file lives here)
├── RAW/        ← Audits, dumps, unprocessed reference material
├── OUTPUTS/    ← Generated reports (gitignored)
└── auto_health_check.py  ← Librarian health scan
```

- **WIKI/** is the authoritative behaviour and architecture layer for AI assistants.
- **RAW/** is reference material — useful context but not prescriptive rules.
- Do not store secrets or user data in any knowledge folder.

---

## 11. What Not to Do (Summary)

| Rule | Detail |
|------|--------|
| ❌ Upload-by-default | Never send files to server when browser processing suffices |
| ❌ FlutterFlow | Not part of this stack — ever |
| ❌ Hardcoded secrets | Use Cloudflare Pages env vars only |
| ❌ Non-Markdown prompts | All AI prompts and WIKI docs in Markdown |
| ❌ Placeholder code | Ship complete implementations |
| ❌ Static heavy imports | Dynamic import pdf.js, Tesseract, FFmpeg |
| ❌ Auto-run on mount | Processing only on explicit user action |
| ❌ Resurrect stale archive | Check `.stale_archive/` before re-adding removed tools |
| ❌ Node.js in Functions | Edge runtime only in `/functions` |

---

*Last updated: 2026-06-18 · Maintainer: GramSeva Mitra engineering team*
