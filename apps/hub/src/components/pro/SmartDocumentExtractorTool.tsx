import { useCallback, useState } from 'react';
import { authClient } from '@gramsevamitra/auth/client';
import { openProUpgrade } from '@shared/lib/proUpgrade';
import {
  stagesForOutputFormat,
  type SmartRouterResponse,
} from '@shared/lib/proTaskStages';
import { parseCreditApiError } from '../../lib/auth/creditCheck';
import { useProCreditConfirm } from '../../lib/auth/useProCreditConfirm';
import ProTaskLoader from './ProTaskLoader';

type OutputFormat = 'json' | 'csv' | 'docx';
type DocumentType = 'invoice' | 'bank_statement';

export default function SmartDocumentExtractorTool() {
  const { data: session, isPending } = authClient.useSession();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('json');
  const [documentType, setDocumentType] = useState<DocumentType>('invoice');
  const [fileName, setFileName] = useState('sample-invoice.pdf');
  const [forceFailsafe, setForceFailsafe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SmartRouterResponse | null>(null);
  const { requestProConfirm, proCreditModal } = useProCreditConfirm();

  const userPlan = (session?.user as { plan?: string } | undefined)?.plan;
  const isPro = userPlan === 'pro';

  const executeExtraction = useCallback(async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const response = await fetch('/api/pro/smart-router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          outputFormat,
          documentType,
          fileName,
          forceFailsafe,
        }),
      });

      const payload = (await response.json()) as SmartRouterResponse & {
        message?: string;
        error?: string;
        requiredCredits?: number;
        remainingCredits?: number;
      };

      if (response.status === 403 || response.status === 401) {
        openProUpgrade({
          featureId: 'smart-document-extractor',
          featureName: 'Smart Document Extractor',
          featureDescription: payload.message ?? 'Pro subscription required.',
        });
        return;
      }

      if (response.status === 402) {
        setError(parseCreditApiError(response.status, payload, 'Insufficient AI Credits.'));
        return;
      }

      if (!response.ok || !payload.success) {
        setError(payload.message ?? payload.error ?? 'Smart Router request failed.');
        return;
      }

      setResult(payload);
    } catch {
      setError('Network error while contacting the Smart Router.');
    } finally {
      setLoading(false);
    }
  }, [documentType, fileName, forceFailsafe, outputFormat]);

  const runExtraction = useCallback(async () => {
    setError(null);
    setResult(null);

    if (!isPro) {
      openProUpgrade({
        featureId: 'smart-document-extractor',
        featureName: 'Smart Document Extractor',
        featureDescription:
          'Extract invoices and bank statements to CSV/JSON, or high-fidelity DOCX — powered by Advanced AI Document Extraction.',
      });
      return;
    }

    void requestProConfirm('smart-router', 'Smart Document Extractor', () => executeExtraction());
  }, [executeExtraction, isPro, requestProConfirm]);

  const stages = stagesForOutputFormat(outputFormat);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-4 shadow-none sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Workspace 1 · Pro</p>
        <h2 className="mt-1 text-lg font-bold text-canvas-text">Smart Document Extractor</h2>
        <p className="mt-1 text-sm font-medium leading-relaxed text-slate-200">
          Test the Tri-Engine Smart Router — Scenario A (JSON/CSV) or Scenario B (DOCX). Mock GPU engines simulate
          5–10 s latency per stage.
        </p>

        {!isPending && (
          <p className="mt-3 text-xs font-medium leading-relaxed text-slate-300">
            {session?.user
              ? `Signed in as ${session.user.email} · plan: ${userPlan ?? 'free'}`
              : 'Not signed in — Pro upgrade required.'}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-canvas-muted">Output format</span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              disabled={loading}
              className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-sm"
            >
              <option value="json">JSON (Scenario A)</option>
              <option value="csv">CSV (Scenario A)</option>
              <option value="docx">DOCX (Scenario B)</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-canvas-muted">Document type</span>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              disabled={loading || outputFormat === 'docx'}
              className="w-full rounded-lg border border-canvas-border bg-canvas-surface px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="invoice">Invoice</option>
              <option value="bank_statement">Bank statement</option>
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-canvas-muted">Sample file name</span>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              disabled={loading}
              className="w-full rounded-lg border border-canvas-border px-3 py-2 text-sm"
              placeholder="invoice-scan.pdf"
            />
          </label>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm font-medium leading-relaxed text-slate-200">
          <input
            type="checkbox"
            checked={forceFailsafe}
            onChange={(e) => setForceFailsafe(e.target.checked)}
            disabled={loading}
            className="rounded border-canvas-border"
          />
          Force Google Vision failsafe (test low-confidence path)
        </label>

        <button
          type="button"
          onClick={() => void runExtraction()}
          disabled={loading || isPending}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-canvas-text transition hover:bg-canvas-elevated disabled:opacity-60"
        >
          {loading ? 'Processing…' : isPro ? 'Review credits & run ⚡' : 'Upgrade to Pro ⚡'}
        </button>
      </div>

      {proCreditModal}

      {loading && <ProTaskLoader active stages={stages} />}

      {error && (
        <p className="rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </p>
      )}

      {result?.success && !loading && (
        <div className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/60 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-canvas-accent">Complete</p>
          <p className="mt-1 text-sm text-canvas-text">
            Scenario {result.scenario} — {result.description}
            {result.usedFailsafe ? ' (Vision failsafe engaged)' : ''}
          </p>
          <p className="mt-1 text-xs text-canvas-muted">
            Simulated pipeline time: {Math.round((result.totalProcessingMs ?? 0) / 1000)}s across{' '}
            {result.pipeline?.length ?? 0} engine calls
          </p>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-canvas-border bg-canvas-surface p-3 text-xs text-canvas-text">
            {JSON.stringify(result.output, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
