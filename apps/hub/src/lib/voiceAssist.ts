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

export function speakText(text: string, langCode = 'en') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG[langCode] || 'en-IN';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function routeForSpokenTool(transcript: string): { href: string; label: string } | null {
  const text = transcript.trim();
  if (!text) return null;
  return TOOL_ROUTES.find((route) => route.test.test(text)) || null;
}
