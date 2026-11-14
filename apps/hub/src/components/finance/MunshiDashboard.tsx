import { useMemo, useState } from 'react';
import CellCheckModal from './CellCheckModal';
import { applyBulkUpload, formatOwnerAmount, munshiMagicLink, whatsAppShareUrl } from '../../lib/audit/ownerExperience';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';

interface ClientRow {
  fileName: string;
  platform: string;
  vertical: 'RESTAURANT' | 'ECOMMERCE';
  status: string;
  recoverablePaise: number;
  unlockFeePaise: number;
  munshiCutPaise: number;
  heldCount: number;
  cellCount: number;
  statement?: Record<string, unknown>;
  audit?: Record<string, unknown>;
  tax?: Record<string, unknown>;
}

const SAMPLE_FILES = [
  { fileName: 'swiggy-week.xlsx', platform: 'SWIGGY', vertical: 'RESTAURANT', recoverablePaise: 450000, unlockFeePaise: 45000, heldCount: 0, cellCount: 0 },
  { fileName: 'zomato-clean.xlsx', platform: 'ZOMATO', vertical: 'RESTAURANT', recoverablePaise: 0, unlockFeePaise: 0, heldCount: 0, cellCount: 0 },
  { fileName: 'meesho-held.xlsx', platform: 'MEESHO', vertical: 'ECOMMERCE', recoverablePaise: 30820, unlockFeePaise: 3082, heldCount: 2, cellCount: 0 },
  { fileName: 'flipkart-cell.xlsx', platform: 'FLIPKART', vertical: 'ECOMMERCE', recoverablePaise: 120000, unlockFeePaise: 12000, heldCount: 0, cellCount: 1 },
];

function badge(status: string) {
  if (status === 'leak') return '🔴 Leak found';
  if (status === 'clean') return '🟢 100% clean';
  if (status === 'cell') return '🟡 1 cell fix';
  if (status === 'held') return '🟠 Held orders';
  return status;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MunshiDashboard() {
  const prefs = useDisplayPrefs();
  const money = (paise: number) => formatOwnerAmount(paise, prefs.indic);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [rejected, setRejected] = useState(0);
  const [filter, setFilter] = useState<'all' | 'RESTAURANT' | 'ECOMMERCE'>('all');
  const [cellClient, setCellClient] = useState<ClientRow | null>(null);
  const [note, setNote] = useState('');
  const [munshiCode, setMunshiCode] = useState('munshi_local');
  const [upiId, setUpiId] = useState('');

  const visible = clients.filter((client) => filter === 'all' || client.vertical === filter);
  const wallet = useMemo(() => clients.reduce((sum, client) => sum + Number(client.munshiCutPaise || 0), 0), [clients]);
  const pendingCells = clients.reduce((sum, client) => sum + Number(client.cellCount || 0), 0);

  const addFile = (file: Record<string, unknown>) => {
    setClients((current) => {
      const result = applyBulkUpload(current as unknown as Array<Record<string, unknown>>, file);
      if (result.rejectedCount) setRejected((count) => count + result.rejectedCount);
      return result.clients as unknown as ClientRow[];
    });
  };

  const loadSamples = () => {
    let next: ClientRow[] = [];
    for (const file of SAMPLE_FILES) {
      const result = applyBulkUpload(next as unknown as Array<Record<string, unknown>>, file);
      next = result.clients as unknown as ClientRow[];
    }
    setClients(next);
  };

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setNote('');
    const { auditUploadedWorkbook } = await import('../../lib/audit/adapters/registry');
    for (const file of Array.from(list)) {
      try {
        const parsed = await auditUploadedWorkbook(new Uint8Array(await file.arrayBuffer()), file.name, {
          commissionBps: null,
          approvedDiscountShareBps: 10000,
          approvedWeeklyAdCapPaise: 100000000,
        });
        const findings = parsed.auditResult.findings || [];
        const recoverablePaise = findings.reduce((sum, finding) => sum + Number(finding.recoverableVariancePaise || 0), 0);
        const heldCount = Array.isArray(parsed.statement.heldOrders) ? parsed.statement.heldOrders.length : 0;
        const cellCount = findings.filter((finding) => finding.ocrConfidenceStatus === 'NEEDS_VERIFICATION').length;
        const unlockFeePaise = recoverablePaise >= 20000 ? Math.round(recoverablePaise / 10) : 0;
        addFile({
          fileName: file.name,
          platform: String(parsed.statement.platform || 'Payout'),
          vertical: parsed.statement.vertical === 'ECOMMERCE' ? 'ECOMMERCE' : 'RESTAURANT',
          recoverablePaise,
          unlockFeePaise,
          heldCount,
          cellCount,
          statement: parsed.statement,
          audit: parsed.auditResult,
          tax: parsed.taxPackage,
        });
      } catch (err) {
        const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
        if (code === 'BOUNCER') addFile({ fileName: file.name, rejected: true });
        else setNote(err instanceof Error ? err.message : 'One file could not be read.');
      }
    }
  };

  const downloadPack = async (client: ClientRow) => {
    if (!client.statement || !client.audit) {
      setNote('Upload the workbook to build its evidence pack.');
      return;
    }
    const { buildEvidencePackWorkbook } = await import('../../lib/audit/evidencePack');
    const pack = buildEvidencePackWorkbook(client.statement, client.audit, client.tax || {});
    downloadBlob(
      `${client.fileName}.evidence.xlsx`,
      new Blob([pack.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
  };

  const withdraw = async () => {
    const amountPaise = Math.round(wallet);
    setNote('');
    try {
      const response = await fetch('/api/audit/munshi-withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ munshiCode, upiId, amountPaise }),
      });
      const data = await response.json();
      setNote(data.success ? 'Withdrawal requested. Admin will settle it to your UPI.' : String(data.message || 'Withdrawal could not be requested.'));
    } catch {
      setNote('Withdrawal could not be requested.');
    }
  };

  const downloadMaster = async (kind: 'csv' | 'xlsx') => {
    if (!clients.length) {
      setNote('Add client files first.');
      return;
    }
    const { buildMasterCaWorkbook, buildMasterTallyCsv } = await import('../../../../../functions/_lib/munshiMasterExport.mjs');
    const rows = clients as unknown as Array<Record<string, unknown>>;
    if (kind === 'csv') {
      downloadBlob('master-tally.csv', new Blob([buildMasterTallyCsv(rows)], { type: 'text/csv' }));
      return;
    }
    const bytes = buildMasterCaWorkbook(rows);
    downloadBlob('master-ca-summary.xlsx', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };

  const downloadTax = (client: ClientRow, kind: 'csv' | 'xml') => {
    const text = String(kind === 'csv' ? client.tax?.tallyJournalCsv || '' : client.tax?.tallyVoucherXml || '');
    if (!text) {
      setNote('Upload the workbook to build the Tally file.');
      return;
    }
    downloadBlob(kind === 'csv' ? 'tally-journal.csv' : 'tally-voucher.xml', new Blob([text], { type: 'text/plain' }));
  };

  return (
    <section className="px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Munshi desk</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-800 p-4">
            <p className="text-xs font-bold uppercase">30% partner commission wallet</p>
            <p className="font-mono text-3xl font-black" data-numerals={prefs.numerals}>{money(wallet)}</p>
          </div>
          <div className="rounded-2xl bg-slate-800 p-4">
            <p className="text-xs font-bold uppercase">Active restaurant and seller clients</p>
            <p className="text-3xl font-black">{clients.length}</p>
          </div>
          <div className="rounded-2xl bg-amber-700 p-4">
            <p className="text-xs font-bold uppercase">Pending 2-second cell checks</p>
            <p className="text-3xl font-black">🟡 {pendingCells}</p>
          </div>
        </div>
        <label className="mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-500 bg-slate-900 p-4 text-center">
          <span className="text-lg font-bold">Drop many Excel, CSV, or PDF files</span>
          <span className="text-sm text-slate-300">Swiggy, Zomato, Meesho, Flipkart, Amazon</span>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.pdf"
            className="sr-only"
            onChange={(event) => {
              void onFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <div className="mt-4 grid gap-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-sm font-bold">
            Munshi code
            <input
              className="mt-1 min-h-12 w-full rounded-xl bg-slate-950 px-3 text-base"
              value={munshiCode}
              aria-label="Munshi code"
              onChange={(event) => setMunshiCode(event.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            UPI ID
            <input
              className="mt-1 min-h-12 w-full rounded-xl bg-slate-950 px-3 text-base"
              value={upiId}
              placeholder="name@upi"
              aria-label="UPI ID"
              onChange={(event) => setUpiId(event.target.value)}
            />
          </label>
          <button type="button" className="min-h-12 self-end rounded-xl bg-emerald-600 px-4 font-black" onClick={() => void withdraw()}>
            Withdraw to UPI
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'RESTAURANT', 'ECOMMERCE'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="rounded-full border border-slate-500 px-3 py-2 text-sm font-bold"
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : value === 'RESTAURANT' ? '🍽️ Restaurants' : '📦 E-commerce sellers'}
            </button>
          ))}
          <button type="button" className="rounded-full bg-white px-3 py-2 text-sm font-bold text-slate-900" onClick={loadSamples}>
            Load sample clients
          </button>
        </div>
        {rejected > 0 && <p className="mt-3 text-sm text-rose-300">{rejected} file{rejected === 1 ? '' : 's'} rejected. They are not payout statements.</p>}
        {note && <p className="mt-3 text-sm text-amber-200">{note}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="min-h-12 rounded-xl bg-white px-4 text-sm font-black text-slate-900" onClick={() => void downloadMaster('csv')}>
            📥 Download Master Tally CSV (All Clients)
          </button>
          <button type="button" className="min-h-12 rounded-xl bg-emerald-700 px-4 text-sm font-black" onClick={() => void downloadMaster('xlsx')}>
            📊 Download Master CA Summary (.xlsx)
          </button>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-300">
              <tr>
                <th className="px-3 py-3">Client file</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Munshi 30% cut</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((client) => (
                <tr key={client.fileName} className="border-t border-slate-800">
                  <td className="px-3 py-3 font-semibold">
                    {client.platform} · {client.fileName}
                    <div className="text-xs text-slate-400">{money(client.recoverablePaise)} found</div>
                  </td>
                  <td className="px-3 py-3">{badge(client.status)}</td>
                  <td className="px-3 py-3">{money(client.munshiCutPaise)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <a className="rounded-lg bg-emerald-700 px-2 py-1 font-bold" href={whatsAppShareUrl(`Your payout check is ready ${munshiMagicLink(client.fileName)}`)}>
                        📲 Share magic link
                      </a>
                      <button type="button" className="rounded-lg bg-slate-700 px-2 py-1 font-bold" onClick={() => void downloadPack(client)}>
                        📥 Evidence pack
                      </button>
                      <button type="button" className="rounded-lg bg-slate-700 px-2 py-1 font-bold" onClick={() => downloadTax(client, 'csv')}>
                        🧾 Tally CSV
                      </button>
                      <button type="button" className="rounded-lg bg-slate-700 px-2 py-1 font-bold" onClick={() => downloadTax(client, 'xml')}>
                        🧾 Tally XML
                      </button>
                      {client.cellCount > 0 && (
                        <button type="button" className="rounded-lg bg-amber-600 px-2 py-1 font-bold text-slate-950" onClick={() => setCellClient(client)}>
                          Fix cell
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-slate-400" colSpan={4}>No clients in this filter yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {cellClient && (
        <CellCheckModal
          extractedPaise={97500}
          expectedPaise={975}
          indic={prefs.indic}
          onClose={() => setCellClient(null)}
          onConfirm={() => {
            setClients((rows) => rows.map((row) => (row.fileName === cellClient.fileName ? { ...row, cellCount: 0, status: row.recoverablePaise > 0 ? 'leak' : 'clean' } : row)));
            setCellClient(null);
          }}
        />
      )}
    </section>
  );
}
