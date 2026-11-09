import { formatOwnerAmount } from '../../lib/audit/ownerExperience';

interface Props {
  extractedPaise: number;
  expectedPaise: number;
  indic: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function CellCheckModal({ extractedPaise, expectedPaise, indic, busy = false, onConfirm, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-[#111827] shadow-xl">
        <p className="text-sm font-black uppercase text-[#D97706]">2-second cell check</p>
        <p className="mt-2 text-lg font-bold">The scan read {formatOwnerAmount(extractedPaise, indic)}.</p>
        <p className="text-2xl font-black">The row balances at {formatOwnerAmount(expectedPaise, indic)}.</p>
        <button
          type="button"
          disabled={busy}
          className="mt-4 min-h-16 w-full rounded-2xl bg-[#16A34A] text-xl font-black text-white disabled:opacity-60"
          onClick={onConfirm}
        >
          Confirm {formatOwnerAmount(expectedPaise, indic)}
        </button>
        <button type="button" className="mt-2 w-full py-3 font-bold" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
