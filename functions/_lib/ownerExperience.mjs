import { formatMinorUnits } from './currency.mjs';
import { calculateMunshiCommission } from './unlockEngine.mjs';

const DEVANAGARI = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

/**
 * @param {number} whole
 */
function groupIndian(whole) {
  const text = String(Math.trunc(whole));
  if (text.length <= 3) return text;
  const head = text.slice(0, text.length - 3);
  const tail = text.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}`;
}

/**
 * @param {string} value
 */
function toDevanagariDigits(value) {
  return value.replace(/[0-9]/g, (digit) => DEVANAGARI[Number(digit)]);
}

/**
 * @param {number} paise
 * @param {boolean} [useIndicDigits]
 */
export function formatOwnerAmount(paise, useIndicDigits = false) {
  const value = Math.trunc(Number(paise) || 0);
  const negative = value < 0;
  const abs = Math.abs(value);
  const body = `${groupIndian(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
  const rendered = useIndicDigits ? toDevanagariDigits(body) : body;
  return `${negative ? '-' : ''}₹${rendered}`;
}

/**
 * @param {number} paise
 * @param {boolean} [useIndicDigits]
 */
export function formatPlainAmount(paise, useIndicDigits = false) {
  return formatMinorUnits(Math.trunc(Number(paise) || 0), '₹', 100, useIndicDigits);
}

/**
 * @param {{
 *   platform?: string,
 *   totalRecoverablePaise?: number,
 *   ownerPocketPaise?: number,
 *   unlockFeePaise?: number,
 *   tickets?: string[],
 * }} input
 */
export function buildOwnerWhatsAppMessage(input) {
  const tickets = Array.isArray(input.tickets) ? input.tickets.filter(Boolean) : [];
  const lines = [
    `GramSevaMitra ${input.platform || 'payout'} check`,
    `Found ${formatOwnerAmount(input.totalRecoverablePaise || 0)}`,
    `Yours ${formatOwnerAmount(input.ownerPocketPaise || 0)}`,
    `Fee ${formatOwnerAmount(input.unlockFeePaise || 0)}`,
    ...tickets,
  ];
  return lines.join('\n');
}

/**
 * @param {string} message
 */
export function whatsAppShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * @param {string} clientId
 */
export function munshiMagicLink(clientId) {
  return `https://www.gramsevamitra.com/owner/?client=${encodeURIComponent(clientId)}`;
}

/**
 * @param {{ rejected?: boolean, cellCount?: number, heldCount?: number, recoverablePaise?: number }} file
 */
export function classifyBulkFile(file) {
  if (file?.rejected) return 'rejected';
  if (Number(file?.cellCount) > 0) return 'cell';
  if (Number(file?.heldCount) > 0) return 'held';
  if (Number(file?.recoverablePaise) > 0) return 'leak';
  return 'clean';
}

/**
 * @param {Array<Record<string, unknown>>} clients
 * @param {Record<string, unknown>} file
 */
export function applyBulkUpload(clients, file) {
  const status = classifyBulkFile(file);
  if (status === 'rejected') {
    return { clients: clients.slice(), rejectedCount: 1, added: null, transition: 'rejected' };
  }
  const unlockFeePaise = Number(file.unlockFeePaise || 0);
  const row = {
    ...file,
    status,
    munshiCutPaise: calculateMunshiCommission(unlockFeePaise),
  };
  const fileName = String(file.fileName || '');
  const next = clients.filter((client) => String(client.fileName || '') !== fileName);
  next.push(row);
  return { clients: next, rejectedCount: 0, added: row, transition: status };
}

/**
 * @param {'en' | 'hi'} language
 */
export function ownerCopy(language) {
  if (language === 'hi') {
    return {
      upload: 'फाइल यहाँ डालें',
      safe: 'सुरक्षित',
      noPassword: 'पासवर्ड नहीं',
      freeCheck: '₹0 जाँच',
      wrongFile: 'गलत फाइल',
      tryAgain: 'फिर कोशिश करें',
      unlock: 'अनलॉक',
      yours: 'आपका हिस्सा',
      fee: 'जांच शुल्क',
      held: 'होल्ड पर',
      clean: 'कोई नुकसान नहीं',
      sendMunshi: 'रिपोर्ट मुंशी को व्हाट्सऐप करें',
      copyTicket: 'शिकायत कॉपी करें',
      download: 'एविडेंस पैक डाउनलोड करें',
    };
  }
  return {
    upload: 'Drop the payout file',
    safe: 'Safe',
    noPassword: 'No password',
      freeCheck: '₹0.00 Free Check',
    wrongFile: 'Wrong file',
    tryAgain: 'Try again',
    unlock: 'Unlock',
    yours: 'Yours',
    fee: 'Check fee',
    held: 'On hold',
    clean: 'No loss',
    sendMunshi: 'Send report and tickets to my munshi on WhatsApp',
    copyTicket: 'Copy the complaint ticket',
    download: 'Download 4-tab evidence pack',
  };
}
