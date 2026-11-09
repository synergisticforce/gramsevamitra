import { useState } from 'react';
import { cropPdfTo4x6Labels } from '../../lib/audit/sellerTools';

export default function QuickThermalLabelCropper() {
  const [note, setNote] = useState('Drop a shipping-label PDF. Each page becomes a 4×6 inch label on this device. ₹0.');
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const bytes = await cropPdfTo4x6Labels(new Uint8Array(await file.arrayBuffer()));
      const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'thermal-4x6.pdf';
      link.click();
      URL.revokeObjectURL(url);
      setNote('Saved thermal-4x6.pdf.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'This PDF could not be cropped.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-200">{note}</p>
      <label className="inline-flex cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">
        {busy ? 'Cropping…' : 'Choose a label PDF'}
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      <a className="block text-sm font-semibold text-canvas-accent underline" href="/seller/">
        Audit this platform&apos;s settlement file
      </a>
    </div>
  );
}
