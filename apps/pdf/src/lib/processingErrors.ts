/** User-facing message when PDF processing fails (corrupt, encrypted, unreadable). */
export const PDF_PROCESSING_ERROR =
  "Oops! We couldn't process this file. Ensure it is a valid, unlocked document.";

export function toProcessingError(_err: unknown): string {
  return PDF_PROCESSING_ERROR;
}
