import { useCallback, useRef, useState } from 'react';
import { APP_WORKSPACES } from '../../config/appWorkspaces';
import { formatFileSize } from '../../lib/canvas/documentCanvasStorage';
import {
  categoryLabel,
  extractBlindDropMetadata,
  type BlindDropMetadata,
} from '../../lib/omni/blindDrop';
import { resolveOmniIntents, workspaceHref, type OmniIntent } from '../../lib/omni/intentEngine';
import { saveOmniHandoff } from '../../lib/omni/handoff';

type OmniPhase = 'idle' | 'intent' | 'error';

interface Props {
  /** Visual theme — `dark` for marketing hero, `light` for App Shell canvases. */
  variant?: 'light' | 'dark';
  disabled?: boolean;
  onIntentSelect?: (intent: OmniIntent, metadata: BlindDropMetadata) => void;
}

const OMNI_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.heic,.mp4,.webm,.mov,.mp3,.wav,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.zip,.txt,.md';

function categoryEmoji(category: BlindDropMetadata['category']): string {
  switch (category) {
    case 'pdf':
      return '📄';
    case 'image':
      return '🖼️';
    case 'video':
      return '🎬';
    case 'audio':
      return '🎵';
    case 'document':
      return '📝';
    case 'spreadsheet':
      return '📊';
    case 'presentation':
      return '📽️';
    case 'archive':
      return '📦';
    case 'text':
      return '📃';
    default:
      return '❓';
  }
}

export default function OmniDropzone({ variant = 'light', disabled = false, onIntentSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<OmniPhase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [metadata, setMetadata] = useState<BlindDropMetadata | null>(null);
  const [intents, setIntents] = useState<OmniIntent[]>([]);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);

  const isDark = variant === 'dark';

  const reset = useCallback(() => {
    setPhase('idle');
    setMetadata(null);
    setIntents([]);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const processFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;

      const meta = extractBlindDropMetadata(file);
      setMetadata(meta);

      if (!meta.supported) {
        setPhase('error');
        setIntents([]);
        return;
      }

      const options = resolveOmniIntents(meta.category);
      setIntents(options);
      setPhase('intent');
    },
    [],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      processFile(files?.[0]);
    },
    [processFile],
  );

  const handleIntentClick = async (intent: OmniIntent) => {
    if (!metadata || redirecting) return;
    if (onIntentSelect) {
      onIntentSelect(intent, metadata);
      return;
    }

    setRedirecting(true);
    setRedirectError(null);
    try {
      await saveOmniHandoff(metadata.file, intent.id, intent.workspaceId);
      window.location.href = workspaceHref(intent.workspaceId, intent.id);
    } catch {
      setRedirecting(false);
      setRedirectError('Could not store your file locally. Check browser storage and try again.');
    }
  };

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && phase === 'idle') setIsDragging(true);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && phase === 'idle') setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  };

  const dropzoneSurface = isDark
    ? [
        'border-emerald-500/40 bg-slate-900/60 text-white backdrop-blur-sm',
        isDragging ? 'border-emerald-400 bg-emerald-950/50 shadow-[0_0_40px_rgba(16,185,129,0.15)]' : 'hover:border-emerald-400/70 hover:bg-slate-900/80',
      ].join(' ')
    : [
        'border-slate-300 bg-white text-slate-900',
        isDragging ? 'border-violet-500 bg-violet-50/80 shadow-inner' : 'hover:border-violet-400 hover:bg-violet-50/30',
      ].join(' ');

  const subtextClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const panelClass = isDark
    ? 'rounded-2xl border border-slate-700/80 bg-slate-900/80 text-white shadow-xl backdrop-blur-sm'
    : 'rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-sm';

  if (phase === 'error' && metadata) {
    return (
      <div className="w-full">
        <div className={`${panelClass} px-5 py-6 sm:px-6`} role="alert">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                Unsupported file type
              </h2>
              <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                <span className="font-medium">{metadata.name}</span> ({formatFileSize(metadata.sizeBytes)}
                {metadata.extension ? ` · .${metadata.extension}` : ''}) cannot be routed yet.
              </p>
              <p className={`mt-2 text-sm ${subtextClass}`}>
                Try a PDF, image, video, audio, Office document, spreadsheet, archive, or plain text file.
              </p>
              <button
                type="button"
                onClick={reset}
                className={`mt-5 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isDark
                    ? 'bg-white/10 text-white hover:bg-white/15'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                Choose another file
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'intent' && metadata) {
    const workspace = APP_WORKSPACES.find((ws) => ws.id === intents[0]?.workspaceId);

    return (
      <div className="w-full">
        <div className={`${panelClass} overflow-hidden`}>
          <div className={`border-b px-5 py-4 sm:px-6 ${isDark ? 'border-slate-700/80 bg-slate-950/40' : 'border-slate-100 bg-slate-50/80'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                    isDark ? 'bg-emerald-500/15' : 'bg-violet-100'
                  }`}
                  aria-hidden="true"
                >
                  {categoryEmoji(metadata.category)}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-emerald-400' : 'text-violet-700'}`}>
                    File detected · {categoryLabel(metadata.category)}
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold sm:text-lg">{metadata.name}</h2>
                  <p className={`mt-0.5 text-xs sm:text-sm ${subtextClass}`}>
                    {formatFileSize(metadata.sizeBytes)}
                    {metadata.mimeType ? ` · ${metadata.mimeType}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className={`shrink-0 rounded-lg border px-2.5 py-1 text-sm transition ${
                  isDark
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                Change file
              </button>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6">
            <h3 className="text-sm font-semibold">What would you like to do?</h3>
            <p className={`mt-1 text-xs sm:text-sm ${subtextClass}`}>
              Choose an action — your file routes to the right workspace tool automatically.
            </p>

            {redirecting && (
              <p className={`mt-3 text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-violet-700'}`} role="status">
                Preparing workspace handoff…
              </p>
            )}

            {redirectError && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                {redirectError}
              </p>
            )}

            <ul className={`mt-4 grid gap-2 sm:grid-cols-2 ${redirecting ? 'pointer-events-none opacity-60' : ''}`}>
              {intents.map((intent) => (
                <li key={intent.id}>
                  <button
                    type="button"
                    onClick={() => handleIntentClick(intent)}
                    className={`group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                      isDark
                        ? 'border-slate-700/80 bg-slate-950/30 hover:border-emerald-500/50 hover:bg-emerald-950/20'
                        : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50'
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {intent.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{intent.label}</span>
                        {intent.tier === 'pro' && (
                          <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            Pro
                          </span>
                        )}
                      </span>
                      <span className={`mt-0.5 block text-xs ${subtextClass}`}>{intent.description}</span>
                      <span
                        className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          intent.tier === 'free'
                            ? isDark
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-emerald-50 text-emerald-800'
                            : isDark
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {intent.quoteLabel}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {workspace && (
              <p className={`mt-4 text-xs ${subtextClass}`}>
                Routed workspace: <span className="font-medium">{workspace.label}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={OMNI_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        className={`relative hidden min-h-[280px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition sm:min-h-[320px] md:flex ${dropzoneSurface} ${
          disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        }`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop any file to begin — Omni Router"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <span className="text-5xl" aria-hidden="true">
          {isDragging ? '📥' : '✨'}
        </span>
        <p className="mt-4 text-lg font-semibold">
          {isDragging ? 'Release to analyze your file' : 'Drop any file here'}
        </p>
        <p className={`mt-2 max-w-lg text-sm ${subtextClass}`}>
          PDF, images, video, audio, Office docs, spreadsheets, and more — we read type &amp; size instantly in your
          browser. No upload.
        </p>
        <p className={`mt-3 text-xs ${subtextClass}`}>Omni-Router · Phase 1 Intent Engine</p>
      </div>

      <div className="md:hidden">
        <div className={`${panelClass} p-6 text-center`}>
          <span className="text-5xl" aria-hidden="true">
            ✨
          </span>
          <p className="mt-4 text-lg font-semibold">Omni-Router</p>
          <p className={`mt-2 text-sm ${subtextClass}`}>
            Tap to pick a file. We detect the type locally and suggest what you can do next.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={`mt-6 inline-flex w-full max-w-sm items-center justify-center rounded-xl px-6 py-4 text-base font-semibold shadow-sm transition active:scale-[0.98] disabled:opacity-60 ${
              isDark ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            Tap to Upload
          </button>
        </div>
      </div>
    </div>
  );
}
