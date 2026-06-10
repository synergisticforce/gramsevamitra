import { useState, type ReactNode } from 'react';
import type { ToolEntry } from '../../config/toolsRegistry';
import { BackToToolsBar } from './WorkspaceNavContext';
import { ToolProgressLoader } from './ToolProgressContext';
import { validateUploadFiles } from '../../lib/fileUploadLimits';

interface Props {
  tool: ToolEntry;
  onBack: () => void;
  children: ReactNode;
}

export default function ToolWorkspaceShell({ tool, children }: Props) {
  return (
    <div className="animate-fade-in min-h-[60vh] pb-[env(safe-area-inset-bottom)]">
      <BackToToolsBar />
      <div className="mt-3 flex items-center gap-3 border-b border-emerald-800/40 pb-4">
        <span className="text-2xl" aria-hidden="true">
          {tool.icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-white">{tool.name}</h2>
          <p className="text-xs text-emerald-200/80">{tool.description}</p>
        </div>
      </div>

      <div className="relative mt-6 overflow-visible rounded-2xl border border-emerald-800/50 bg-slate-900/80 p-4 sm:p-6">
        <ToolProgressLoader />
        {children}
      </div>
    </div>
  );
}

interface FileDropProps {
  accept: string;
  multiple?: boolean;
  label: string;
  onFiles: (files: File[]) => void;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SelectedFileStatus({
  file,
  files,
}: {
  file?: File | null;
  files?: File[];
}) {
  const list = files?.length ? files : file ? [file] : [];
  if (!list.length) return null;

  const totalBytes = list.reduce((sum, f) => sum + f.size, 0);
  const label =
    list.length === 1
      ? list[0].name
      : `${list.length} files selected (${list[0].name}${list.length > 1 ? ', …' : ''})`;

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-700/40 bg-[#064e3b]/25 px-4 py-3"
      role="status"
    >
      <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-300">
        File loaded locally
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-400">{formatFileSize(totalBytes)}</p>
      </div>
    </div>
  );
}

export function UploadLimitHelperText() {
  return (
    <>
      <p className="mt-2 text-center text-xs text-slate-500 block md:hidden">
        Max upload: 1GB (Use a PC/Laptop for up to 2GB)
      </p>
      <p className="mt-2 text-center text-xs text-slate-500 hidden md:block">
        Max upload: 2GB
      </p>
    </>
  );
}

export function FileDropZone({ accept, multiple = false, label, onFiles }: FileDropProps) {
  const [limitAlert, setLimitAlert] = useState<string | null>(null);

  const handleFiles = (list: File[]) => {
    const { accepted, rejectedMessage } = validateUploadFiles(list);
    if (rejectedMessage) {
      setLimitAlert(rejectedMessage);
      return;
    }
    setLimitAlert(null);
    onFiles(accepted);
  };

  return (
    <div>
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-600/50 bg-[#064e3b]/30 px-4 py-10 text-center transition hover:border-emerald-400 hover:bg-[#064e3b]/50">
        <span className="text-3xl" aria-hidden="true">
          📁
        </span>
        <span className="mt-3 text-sm font-semibold text-emerald-300">{label}</span>
        <span className="mt-1 text-xs text-slate-400">Tap to choose — stays on your device</span>
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const list = e.target.files ? Array.from(e.target.files) : [];
            if (list.length) handleFiles(list);
            e.target.value = '';
          }}
        />
      </label>
      <UploadLimitHelperText />
      {limitAlert && (
        <p
          className="mt-3 rounded-lg border border-amber-600/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
          role="alert"
        >
          {limitAlert}
        </p>
      )}
    </div>
  );
}

export function StatusMessage({
  error,
  success,
  warning,
}: {
  error?: string | null;
  success?: string | null;
  warning?: string | null;
}) {
  if (warning) {
    return (
      <p
        className="rounded-lg border border-amber-600/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-100"
        role="status"
      >
        {warning}
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg border border-red-800/60 bg-red-950/40 px-4 py-3 text-sm text-red-200" role="alert">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
        {success}
      </p>
    );
  }
  return null;
}

export function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-[#064e3b] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
    >
      {children}
    </button>
  );
}
