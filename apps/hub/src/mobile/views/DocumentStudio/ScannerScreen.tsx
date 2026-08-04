import { useDocumentScanner } from '../../hooks/useDocumentScanner';
import { useIdScanner } from '../../hooks/useIdScanner';

export default function ScannerScreen() {
  const { scanDocument, isScanning, error } = useDocumentScanner();
  const { scanIdCard, isScanningId, idError } = useIdScanner();
  const busy = isScanning || isScanningId;
  const activeError = idError ?? error;

  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-between gap-6 px-4 py-6 sm:px-5">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-canvas-subtle">
          Document Studio
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-canvas-text">Scan a document</h1>
        <p className="text-sm font-medium leading-relaxed text-slate-300">
          Launch the native scanner for edge detection, shadow cleanup, and an instant offline PDF
          saved to your vault — or merge ID front &amp; back onto one page.
        </p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div
          className="flex h-36 w-36 items-center justify-center rounded-full border border-canvas-border bg-canvas-accent-soft text-5xl"
          aria-hidden="true"
        >
          {busy ? (
            <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-canvas-border border-t-canvas-accent" />
          ) : (
            '📄'
          )}
        </div>

        <button
          type="button"
          onClick={() => void scanDocument()}
          disabled={busy}
          className="inline-flex w-full max-w-sm items-center justify-center rounded-2xl bg-canvas-accent-muted px-6 py-5 text-lg font-bold text-canvas-text transition hover:bg-canvas-accent/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanning ? 'Scanning…' : 'Scan New Document'}
        </button>

        <button
          type="button"
          onClick={() => void scanIdCard()}
          disabled={busy}
          className="inline-flex w-full max-w-sm items-center justify-center rounded-2xl border border-canvas-border bg-canvas-elevated px-6 py-4 text-base font-semibold text-canvas-text transition hover:bg-canvas-accent-muted active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanningId ? 'Scanning ID…' : 'Scan ID Card (Front & Back)'}
        </button>

        <p className="max-w-sm text-center text-xs font-medium leading-relaxed text-slate-300">
          {isScanningId
            ? 'Scan the front, then the back — we merge both onto one A4 JPEG in your vault.'
            : isScanning
              ? 'Align the page in the camera — ML Kit is cropping and cleaning your scan.'
              : 'Works offline on Android. Finished files are stored in your Local Vault.'}
        </p>
      </div>

      {activeError && (
        <p
          className="rounded-xl border border-canvas-border bg-canvas-danger-soft/30 px-4 py-3 text-sm font-medium leading-relaxed text-rose-200"
          role="alert"
        >
          {activeError}
        </p>
      )}
    </section>
  );
}
