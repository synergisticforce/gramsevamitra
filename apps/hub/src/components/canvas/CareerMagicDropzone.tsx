import { useCallback, useRef, useState } from 'react';
import { CAREER_ACCEPT, isCareerDocumentMimeOrName } from '../../config/careerCanvasActions';

interface Props {
  onFileSelect: (file: File) => void;
  onInvalidFile?: () => void;
  disabled?: boolean;
}

export default function CareerMagicDropzone({ onFileSelect, onInvalidFile, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!isCareerDocumentMimeOrName(file.type, file.name)) {
        onInvalidFile?.();
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, onInvalidFile]
  );

  const onDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
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

  const dropzoneClass = [
    'relative flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition sm:min-h-[380px]',
    isDragging
      ? 'border-sky-500 bg-canvas-elevated/80 shadow-inner'
      : 'border-canvas-border bg-canvas-surface hover:border-sky-400 hover:bg-canvas-elevated/30',
    disabled ? 'pointer-events-none opacity-60' : 'cursor-pointer',
  ].join(' ');

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept={CAREER_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div
        className={`${dropzoneClass} hidden md:flex`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drop a resume or cover letter to begin"
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
          {isDragging ? '📥' : '🎯'}
        </span>
        <p className="mt-4 text-lg font-semibold text-canvas-text">
          {isDragging ? 'Release to load your document' : 'Drop your resume or cover letter here'}
        </p>
        <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-200">
          PDF or Word (DOCX) — processed locally in your browser. Or click to browse.
        </p>
      </div>

      <div className="md:hidden">
        <div className="rounded-2xl border border-canvas-border bg-canvas-surface p-6 text-center shadow-none">
          <span className="text-5xl" aria-hidden="true">
            🎯
          </span>
          <p className="mt-4 text-lg font-semibold text-canvas-text">Add a document</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-200">
            Tap below to pick a PDF or Word file from your device.
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-6 inline-flex w-full max-w-sm items-center justify-center rounded-xl bg-canvas-accent-muted px-6 py-4 text-base font-semibold text-canvas-text shadow-none transition hover:bg-canvas-elevated active:scale-[0.98] disabled:opacity-60"
          >
            Tap to Upload
          </button>
        </div>
      </div>
    </div>
  );
}
