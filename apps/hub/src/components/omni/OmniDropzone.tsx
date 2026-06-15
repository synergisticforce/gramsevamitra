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
        'border-canvas-border/60 bg-canvas-accent-muted/60 text-slate-100 backdrop-blur-sm',
        isDragging ? 'border-slate-500 bg-canvas-elevated/60' : 'hover:border-slate-500/80 hover:bg-canvas-accent-muted/80',
      ].join(' ')
    : [
        'border-canvas-border bg-canvas-surface text-canvas-text',
        isDragging ? 'border-canvas-border bg-canvas-elevated shadow-inner' : 'hover:border-canvas-border hover:bg-canvas-elevated',
      ].join(' ');

  const subtextClass = 'text-sm font-medium leading-relaxed text-slate-200';
  const metaClass = 'text-xs font-medium leading-relaxed text-slate-300';
  const panelClass = isDark
    ? 'rounded-2xl border border-canvas-border/80 bg-canvas-accent-muted/80 text-slate-100 shadow-none backdrop-blur-sm'
    : 'rounded-2xl border border-canvas-border bg-canvas-surface text-canvas-text shadow-none';

  if (phase === 'error' && metadata) {
    return (
      <div className="w-full">
        <div className={`${panelClass} px-5 py-6 sm:px-6`} role="alert">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-canvas-danger-soft/300/15 text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <div className="min-w-0 flex-1">
              <h2 className={`text-lg font-semibold ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
                Unsupported file type
              </h2>
              <p className={`mt-2 text-sm font-medium leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-200'}`}>
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
                    ? 'bg-canvas-surface/10 text-canvas-text hover:bg-canvas-surface/15'
                    : 'bg-canvas-accent-muted text-canvas-text hover:bg-canvas-elevated'
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
          <div className={`border-b px-5 py-4 sm:px-6 ${isDark ? 'border-canvas-border/80 bg-slate-950/40' : 'border-slate-100 bg-canvas-elevated/80'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                    isDark ? 'bg-canvas-accent-muted/40' : 'bg-canvas-elevated'
                  }`}
                  aria-hidden="true"
                >
                  {categoryEmoji(metadata.category)}
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${metaClass}`}>
                    File detected · {categoryLabel(metadata.category)}
                  </p>
                  <h2 className="mt-1 truncate text-base font-semibold text-slate-100 sm:text-lg">{metadata.name}</h2>
                  <p className={`mt-0.5 ${metaClass}`}>
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
                    ? 'border-canvas-border text-canvas-muted hover:bg-canvas-elevated'
                    : 'border-canvas-border text-canvas-subtle hover:bg-canvas-elevated'
                }`}
              >
                Change file
              </button>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6">
            <h3 className="text-sm font-semibold text-slate-100">What would you like to do?</h3>
            <p className={`mt-1 ${subtextClass}`}>
              Choose an action — your file routes to the right workspace tool automatically.
            </p>

            {redirecting && (
              <p className={`mt-3 text-sm font-medium leading-relaxed text-slate-200`} role="status">
                Preparing workspace handoff…
              </p>
            )}

            {redirectError && (
              <p className="mt-3 rounded-lg border border-canvas-border bg-canvas-danger-soft/30 px-3 py-2 text-sm font-medium leading-relaxed text-rose-200" role="alert">
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
                        ? 'border-canvas-border/80 bg-slate-950/30 hover:border-slate-500/50 hover:bg-canvas-accent-muted/40'
                        : 'border-canvas-border bg-canvas-surface hover:border-canvas-border hover:bg-canvas-elevated'
                    }`}
                  >
                    <span className="text-xl" aria-hidden="true">
                      {intent.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{intent.label}</span>
                        {intent.tier === 'pro' && (
                          <span className="rounded-full bg-canvas-accent-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-canvas-text">
                            Pro
                          </span>
                        )}
                      </span>
                      <span className={`mt-0.5 block ${metaClass}`}>{intent.description}</span>
                      <span
                        className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          intent.tier === 'free'
                            ? isDark
                              ? 'bg-canvas-accent-muted/30 text-canvas-muted'
                              : 'bg-canvas-elevated text-canvas-muted'
                            : isDark
                              ? 'bg-amber-900/20 text-amber-200/90'
                              : 'bg-canvas-elevated text-slate-200/80'
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
        aria-label="Drop any file to begin"
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
        <p className="mt-4 text-lg font-semibold text-slate-100">
          {isDragging ? 'Release to analyze your file' : 'Drop any file here'}
        </p>
        <p className={`mt-2 max-w-lg ${subtextClass}`}>
          PDF, images, video, audio, Office docs, spreadsheets, and more — we read type &amp; size instantly in your
          browser. No upload.
        </p>
        <p className={`mt-3 ${metaClass}`}>Smart file detection · instant suggestions</p>
      </div>

      <div className="md:hidden">
        <div className={`${panelClass} p-6 text-center`}>
          <span className="text-5xl" aria-hidden="true">
            ✨
          </span>
          <p className="mt-4 text-lg font-semibold text-slate-100">Upload a file</p>
          <p className={`mt-2 ${subtextClass}`}>
            Tap to pick a file. We detect the type locally and suggest what you can do next.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={`mt-6 inline-flex w-full max-w-sm items-center justify-center rounded-xl px-6 py-4 text-base font-semibold shadow-none transition active:scale-[0.98] disabled:opacity-60 ${
              isDark ? 'bg-canvas-accent-muted text-canvas-text hover:bg-canvas-elevated0' : 'bg-canvas-accent-muted text-canvas-text hover:bg-canvas-accent/40'
            }`}
          >
            Tap to Upload
          </button>
        </div>
      </div>
    </div>
  );
}
