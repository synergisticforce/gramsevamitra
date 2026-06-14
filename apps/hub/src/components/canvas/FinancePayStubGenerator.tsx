import { useEffect, useMemo, useState } from 'react';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  buildPayStubText,
  computePayStubTotals,
  createPayStubLineId,
  DEFAULT_PAY_STUB,
  exportPayStubPdf,
  triggerPayStubDownload,
  type PayStubFormData,
} from '../../lib/finance/payStubDocument';

export default function FinancePayStubGenerator() {
  const initial = useMemo(
    () => loadPersistedJson<PayStubFormData>(FINANCE_STORAGE_KEYS.paystub, DEFAULT_PAY_STUB),
    []
  );
  const [form, setForm] = useState<PayStubFormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.paystub, form);
  }, [form]);

  const preview = useMemo(() => buildPayStubText(form), [form]);
  const totals = useMemo(() => computePayStubTotals(form), [form]);
  const update = (patch: Partial<PayStubFormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const inputClass =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500/30 focus:border-emerald-400 focus:ring-2';

  const renderLines = (key: 'earnings' | 'deductions', title: string) => (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      {form[key].map((row, index) => (
        <div key={row.id} className="mt-2 grid grid-cols-2 gap-2">
          <input value={row.label} onChange={(e) => {
            const rows = [...form[key]];
            rows[index] = { ...row, label: e.target.value };
            update({ [key]: rows });
          }} className={inputClass} />
          <input type="number" min={0} value={row.amount} onChange={(e) => {
            const rows = [...form[key]];
            rows[index] = { ...row, amount: Number(e.target.value) || 0 };
            update({ [key]: rows });
          }} className={inputClass} />
        </div>
      ))}
      <button type="button" onClick={() => update({ [key]: [...form[key], { id: createPayStubLineId(), label: 'New', amount: 0 }] })} className="mt-2 text-xs font-semibold text-emerald-700">
        + Add {title.slice(0, -1).toLowerCase()}
      </button>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Pay stub</h2>
        {(['employerName', 'employeeName', 'employeeId', 'payPeriod', 'payDate'] as const).map((key) => (
          <label key={key} className="mt-3 block text-sm font-medium text-slate-700">
            {key.replace(/([A-Z])/g, ' $1')}
            <input type={key === 'payDate' ? 'date' : 'text'} value={form[key]} onChange={(e) => update({ [key]: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
        ))}
        {renderLines('earnings', 'Earnings')}
        {renderLines('deductions', 'Deductions')}
        <button type="button" disabled={busy} onClick={() => void (async () => {
          setBusy(true); setError(null);
          try {
            const blob = await exportPayStubPdf(form);
            triggerPayStubDownload(blob, form.employeeName);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'PDF export failed.');
          } finally { setBusy(false); }
        })()} className="mt-5 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? 'Exporting…' : 'Download PDF'}
        </button>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </section>
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
        <p className="text-xs font-semibold uppercase text-emerald-700">Net pay</p>
        <p className="mt-2 text-3xl font-bold text-emerald-900">{formatInr(totals.netPay)}</p>
        <p className="mt-1 text-sm text-slate-600">Gross {formatInr(totals.grossPay)} · Deductions {formatInr(totals.totalDeductions)}</p>
        <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-[11px] leading-relaxed text-slate-800">{preview}</pre>
      </section>
    </div>
  );
}
