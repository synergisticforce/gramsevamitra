# UI and tool audit

Updated: 14 November 2026, after the 158-page site capture and the 72-PDF merge lockup.

The site stays on Cloudflare Pages, Neon PostgreSQL, and integer paise. There is no Python server.

## What was hard to use

- The same studios were listed in the top bar and the left sidebar, and the labels collided on narrow widths.
- Dropping a PDF opened every specialist action at once, including a Vision Extract button aimed at a retired route.
- Merging many PDFs put the Merge button below the file list, so the page could not be scrolled to it.
- `/owner/` needed a daylight passbook surface and a free-check label that stays `₹0.00` in Latin digits.
- `/munshi/` wallet text follows the `123` / `१२३` toggle. The default is Latin digits, so zero is `₹0.00`.
- The seller banner sat on every studio page.

## What changed

- Merge modal: pinned Merge, 1→9 sort, reverse, clear, and close. The file list scrolls inside `max-h-[48vh]`. Pages are copied one PDF at a time.
- Desktop top bar keeps Owner, Seller, and Munshi. Studio links stay on the phone bar and the left sidebar.
- Simple mode speaks the three steps. Speak jumps to payout, PDF, photo, or loan tools. Languages include Hindi, Bangla, Tamil, Marathi, Spanish, French, Kiswahili, and Arabic. Currency marks are ₹ $ € £ ₦. Payout audits stay in rupees.
- Document Studio shows Merge, Split, Compress, and Convert first. The other PDF tools sit behind “Show All 15+ PDF Tools”. Vision Extract is not a button. Retired `/api/pro/extract`, `smart-extract`, `ocr-orchestrator`, `reconstruct-layout`, and `media-process` strings are gone from `apps/hub/src`.
- Finance Hub shows EMI, GST, invoice, and currency first, plus the moneylender monthly-rate card (2% a month is 24% a year). The other calculators are behind one drawer.
- Quick Tools shows the label cropper, courier slab, QR code, and unit converter first.
- Compress PDF and the exam photo tool have 100 KB, 200 KB, and 500 KB targets. Image Studio can download a 4×6 inch sheet of 8 photos (1200×1800 px).
- The seller banner can be dismissed and stays hidden in Simple mode. Headers and the feedback button do not print.

## Checks

`node scripts/test-ux-and-all-tools.mjs` merged 75 one-page PDFs in 14 ms and checked the layout rules above. Phase 1 through the post-Opus closure tests, typecheck, and the production build passed.

## Still true

A person still has to try a real Swiggy file and a real 72-page merge on a phone. The automated check proves the merge helper, the sort order, and that the retired routes are not named in the site source. It does not click every calculator in a browser.
