import { useEffect, useState } from 'react';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import type { AppLanguage, CurrencyCode } from '../../lib/audit/displayPrefs';
import { routeForSpokenTool, speakText } from '../../lib/voiceAssist';

const ROLES = [
  { href: '/owner/', label: 'Owner App', emoji: '🍽️' },
  { href: '/seller/', label: 'Seller Hub', emoji: '📦' },
  { href: '/munshi/', label: 'Munshi Desk', emoji: '💼' },
] as const;

const STUDIOS = [
  { href: '/workspace/finance/', label: 'Finance', emoji: '💰' },
  { href: '/workspace/documents/', label: 'Documents', emoji: '📄' },
  { href: '/workspace/image/', label: 'Images', emoji: '🖼️' },
  { href: '/workspace/video/', label: 'Video', emoji: '🎬' },
  { href: '/workspace/career/', label: 'Career', emoji: '🎯' },
  { href: '/workspace/quick-tools/', label: 'Tools', emoji: '⚡' },
] as const;

const LANGUAGES: Array<{ id: AppLanguage; label: string }> = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'mr', label: 'मराठी' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'sw', label: 'Kiswahili' },
  { id: 'ar', label: 'العربية' },
];

const CURRENCIES: CurrencyCode[] = ['INR', 'USD', 'EUR', 'GBP', 'NGN'];
const CURRENCY_MARK: Record<CurrencyCode, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

export default function SiteDoorBar({ tone = 'dark' }: { tone?: 'dark' | 'daylight' }) {
  const prefs = useDisplayPrefs();
  const light = tone === 'daylight';
  const [path, setPath] = useState('');
  const [heard, setHeard] = useState('');
  const linkClass = light
    ? 'shrink-0 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900'
    : 'shrink-0 rounded-full border border-canvas-border px-3 py-2 text-sm font-semibold text-slate-100';
  const controlClass = light
    ? 'min-h-10 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900'
    : 'min-h-10 rounded-full border border-canvas-border px-3 py-2 text-sm font-semibold text-slate-100';

  useEffect(() => {
    setPath(window.location.pathname);
  }, []);

  const onRolePage = /\/(owner|seller|munshi)\//.test(path);

  const speakFinder = () => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      const typed = window.prompt('Say a tool: Swiggy, PDF, Merge, Photo, Loan') || '';
      const route = routeForSpokenTool(typed);
      if (route) window.location.href = route.href;
      else setHeard(typed ? 'No matching tool.' : '');
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = prefs.language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
      const text = event.results[0]?.[0]?.transcript || '';
      setHeard(text);
      const route = routeForSpokenTool(text);
      if (route) window.location.href = route.href;
    };
    recognition.start();
  };

  return (
    <>
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <nav className="flex min-w-0 flex-wrap gap-2" aria-label="Quick jump">
          {ROLES.map((door) => (
            <a key={door.href} href={door.href} className={linkClass}>
              <span aria-hidden="true">{door.emoji} </span>
              {door.label}
            </a>
          ))}
          {onRolePage && (
            <a href="/" className={linkClass}>🏠 Free Studios</a>
          )}
          {STUDIOS.map((door) => (
            <a key={door.href} href={door.href} className={`${linkClass} lg:hidden`}>
              <span aria-hidden="true">{door.emoji} </span>
              {door.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={controlClass}
            aria-pressed={prefs.simpleMode}
            onClick={() => {
              const next = !prefs.simpleMode;
              prefs.setSimpleMode(next);
              if (next) speakText('Simple mode on. Step 1 choose a file. Step 2 tap an action. Step 3 download.', prefs.language);
            }}
          >
            🔊 {prefs.simpleMode ? 'Simple' : 'सरल / Simple'}
          </button>
          <button type="button" className={controlClass} onClick={speakFinder} aria-label="Speak a tool name">
            🎤 बोलें / Speak
          </button>
          <label className="sr-only" htmlFor="gsm-currency">Currency</label>
          <select
            id="gsm-currency"
            className={controlClass}
            aria-label="Currency"
            value={prefs.currency}
            onChange={(event) => prefs.setCurrency(event.target.value as CurrencyCode)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>{CURRENCY_MARK[code]}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="gsm-language">Language</label>
          <select
            id="gsm-language"
            className={controlClass}
            aria-label="Language"
            value={prefs.language}
            onChange={(event) => prefs.setLanguage(event.target.value as AppLanguage)}
          >
            {LANGUAGES.map((language) => (
              <option key={language.id} value={language.id}>{language.label}</option>
            ))}
          </select>
          <button
            type="button"
            className={controlClass}
            aria-label={prefs.numerals === 'devanagari' ? 'Switch numerals to 123' : 'अंक १२३ में बदलें'}
            onClick={() => prefs.setNumerals(prefs.numerals === 'devanagari' ? 'latin' : 'devanagari')}
          >
            {prefs.numerals === 'devanagari' ? '१२३' : '123'}
          </button>
        </div>
        {heard && <p className="w-full text-xs font-bold">{heard}</p>}
      </div>
      <nav className="print:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-300 bg-white lg:hidden" aria-label="Phone tools">
        <a className="min-h-14 px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/finance/">💰 Money</a>
        <a className="min-h-14 px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/documents/">📄 PDF/Scan</a>
        <a className="min-h-14 px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/image/">🖼️ Photo/ID</a>
        <a className="min-h-14 px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/quick-tools/">⚡ Tools</a>
      </nav>
    </>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: new () => {
      lang: string;
      start: () => void;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
    };
    webkitSpeechRecognition?: new () => {
      lang: string;
      start: () => void;
      onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
    };
  }
}
