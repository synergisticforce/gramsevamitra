export function formatOwnerAmount(paise: number, useIndicDigits?: boolean): string;
export function formatPlainAmount(paise: number, useIndicDigits?: boolean): string;
export function buildOwnerWhatsAppMessage(input: {
  platform?: string;
  totalRecoverablePaise?: number;
  ownerPocketPaise?: number;
  unlockFeePaise?: number;
  tickets?: string[];
}): string;
export function whatsAppShareUrl(message: string): string;
export function munshiMagicLink(clientId: string): string;
export function classifyBulkFile(file: {
  rejected?: boolean;
  cellCount?: number;
  heldCount?: number;
  recoverablePaise?: number;
}): 'rejected' | 'cell' | 'held' | 'leak' | 'clean';
export function applyBulkUpload(
  clients: Array<Record<string, unknown>>,
  file: Record<string, unknown>,
): {
  clients: Array<Record<string, unknown>>;
  rejectedCount: number;
  added: Record<string, unknown> | null;
  transition: string;
};
export function ownerCopy(language: 'en' | 'hi'): Record<string, string>;
