import { useEffect, useMemo, useState } from 'react';
import {
  FINANCE_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/financeCanvasStorage';
import { formatInr } from '../../lib/finance/formatInr';
import {
  buildInvoiceText,
  computeInvoiceTotals,
  createLineItemId,
  DEFAULT_INVOICE,
  exportInvoicePdf,
  triggerInvoiceDownload,
  type InvoiceFormData,
} from '../../lib/finance/invoiceDocument';

export default function FinanceInvoiceBuilder() {
  const initial = useMemo(
    () => loadPersistedJson<InvoiceFormData>(FINANCE_STORAGE_KEYS.invoice, DEFAULT_INVOICE),
    []
  );
  const [form, setForm] = useState<InvoiceFormData>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    savePersistedJson(FINANCE_STORAGE_KEYS.invoice, form);
  }, [form]);

  const preview = useMemo(() => buildInvoiceText(form), [form]);
  const totals = useMemo(() => computeInvoiceTotals(form), [form]);

  const update = (patch: Partial<InvoiceFormData>) => setForm((prev) => ({ ...prev, ...patch }));

  const inputClass =
    'w-full rounded-xl border border-canvas-border px-3 py-2.5 text-sm outline-none ring-canvas-accent/50/30 focus:border-canvas-accent focus:ring-2';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-canvas-border bg-canvas-surface p-5 shadow-none">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-canvas-subtle">Invoice details</h2>
        {(
          [
            ['businessName', 'Your business'],
            ['businessEmail', 'Your email'],
            ['clientName', 'Client name'],
            ['clientEmail', 'Client email'],
            ['invoiceNumber', 'Invoice #'],
            ['invoiceDate', 'Date', 'date'],
            ['dueDate', 'Due date', 'date'],
          ] as const
        ).map(([key, label, type]) => (
          <label key={key} className="block text-sm font-medium text-canvas-muted">
            {label}
            <input
              type={type ?? 'text'}
              value={form[key]}
              onChange={(e) => update({ [key]: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </label>
        ))}
        <label className="block text-sm font-medium text-canvas-muted">
          Tax ({form.taxPercent}%)
          <input type="range" min={0} max={28} value={form.taxPercent} onChange={(e) => update({ taxPercent: Number(e.target.value) })} className="mt-2 w-full accent-emerald-600" />
        </label>
        {form.lineItems.map((item, index) => (
          <div key={item.id} className="grid grid-cols-3 gap-2 rounded-xl border border-slate-100 bg-canvas-elevated p-3">
            <input value={item.description} onChange={(e) => {
              const lineItems = [...form.lineItems];
              lineItems[index] = { ...item, description: e.target.value };
              update({ lineItems });
            }} placeholder="Description" className={inputClass} />
            <input type="number" min={1} value={item.quantity} onChange={(e) => {
              const lineItems = [...form.lineItems];
              lineItems[index] = { ...item, quantity: Number(e.target.value) || 1 };
              update({ lineItems });
            }} className={inputClass} />
            <input type="number" min={0} value={item.unitPrice} onChange={(e) => {
              const lineItems = [...form.lineItems];
              lineItems[index] = { ...item, unitPrice: Number(e.target.value) || 0 };
              update({ lineItems });
            }} className={inputClass} />
          </div>
        ))}
        <button type="button" onClick={() => update({ lineItems: [...form.lineItems, { id: createLineItemId(), description: 'Item', quantity: 1, unitPrice: 0 }] })} className="w-full rounded-xl border border-dashed border-canvas-border py-2 text-sm font-semibold text-canvas-muted">
          + Add line item
        </button>
        <textarea rows={2} value={form.notes} onChange={(e) => update({ notes: e.target.value })} className={`${inputClass} resize-y`} placeholder="Notes" />
        <button type="button" disabled={busy} onClick={() => void (async () => {
          setBusy(true); setError(null);
          try {
            const blob = await exportInvoicePdf(form);
            triggerInvoiceDownload(blob, form.invoiceNumber);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'PDF export failed.');
          } finally { setBusy(false); }
        })()} className="w-full rounded-xl bg-canvas-accent-muted py-2.5 text-sm font-semibold text-canvas-text disabled:opacity-50">
          {busy ? 'Exporting…' : 'Download PDF'}
        </button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>
      <section className="rounded-2xl border border-canvas-border bg-canvas-accent-soft/50 p-5">
        <p className="text-xs font-semibold uppercase text-canvas-accent">Live preview</p>
        <p className="mt-2 text-2xl font-bold text-emerald-900">{formatInr(totals.total)}</p>
        <pre className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl border border-canvas-border bg-canvas-surface p-4 font-sans text-[11px] leading-relaxed text-canvas-text">{preview}</pre>
      </section>
    </div>
  );
}
