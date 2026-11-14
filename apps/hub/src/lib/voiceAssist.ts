import { resolveSpeakLanguage } from '../../../../functions/_lib/voiceFallback.mjs';

export const VOICE_LANG: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  mr: 'mr-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  sw: 'sw-KE',
  ar: 'ar-SA',
};

const TOOL_ROUTES: Array<{ test: RegExp; href: string; label: string }> = [
  { test: /swiggy|zomato|payout|restaurant/i, href: '/owner/', label: 'Owner payout check' },
  { test: /seller|meesho|flipkart|amazon/i, href: '/seller/', label: 'Seller hub' },
  { test: /munshi/i, href: '/munshi/', label: 'Munshi desk' },
  { test: /merge|compress|pdf|scan/i, href: '/workspace/documents/', label: 'Document studio' },
  { test: /photo|passport|image/i, href: '/workspace/image/', label: 'Image studio' },
  { test: /loan|emi|gst|money/i, href: '/workspace/finance/', label: 'Finance hub' },
];

function showSpeechToast(text: string) {
  if (typeof document === 'undefined') return;
  const node = document.createElement('div');
  node.setAttribute('role', 'status');
  node.textContent = `🔊 ${text}`;
  node.style.cssText = 'position:fixed;left:1rem;right:1rem;bottom:5.5rem;z-index:80;border-radius:16px;background:#111827;color:#fff;padding:14px 16px;font-weight:800;';
  document.body.appendChild(node);
  window.setTimeout(() => node.remove(), 3000);
}

export function speakText(text: string, langCode = 'en') {
  showSpeechToast(text);
  try {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices?.() || [];
    const chosen = resolveSpeakLanguage(langCode, voices);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = chosen.lang;
    const match = voices.find((voice) => voice.lang?.toLowerCase().startsWith(chosen.lang.toLowerCase()));
    if (match) utterance.voice = match;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    /* The toast already shows the words when this phone has no voice pack. */
  }
}

export function routeForSpokenTool(transcript: string): { href: string; label: string } | null {
  const text = transcript.trim();
  if (!text) return null;
  return TOOL_ROUTES.find((route) => route.test.test(text)) || null;
}
