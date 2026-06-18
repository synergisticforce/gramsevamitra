import { useEffect } from 'react';

type ProcessingReporter = (active: boolean, label: string, percent: number) => void;

/** Surface PDF metadata reads through the workspace processing overlay. */
export function useModalMetaLoading(
  loadingMeta: boolean,
  busy: boolean,
  onProcessingChange: ProcessingReporter,
  label = 'Reading PDF metadata… Please wait',
) {
  useEffect(() => {
    if (loadingMeta) {
      onProcessingChange(true, label, 5);
      return;
    }
    if (!busy) {
      onProcessingChange(false, '', 0);
    }
  }, [busy, label, loadingMeta, onProcessingChange]);
}
