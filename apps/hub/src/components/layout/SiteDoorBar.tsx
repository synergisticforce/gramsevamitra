import { useEffect, useState } from 'react';
import { SIDEBAR_TOGGLE_EVENT } from '../../lib/app/shellEvents';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import type { AppLanguage, CurrencyCode } from '../../lib/audit/displayPrefs';
import { routeForSpokenTool, speakText } from '../../lib/voiceAssist';

const LANGUAGES: Array<{ id: AppLanguage; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'ta', label: 'தமிழ்' },
  { id: 'mr', label: 'मराठी' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'sw', label: 'Kiswahili' },
  { id: 'ar', label: 'العربية' },
];

const CURRENCIES: Array<{ id: CurrencyCode; label: string }> = [
  { id: 'INR', label: '₹ INR' },
  { id: 'USD', label: '$ USD' },
  { id: 'EUR', label: '€ EUR' },
  { id: 'GBP', label: '£ GBP' },
  { id: 'NGN', label: '₦ NGN' },
];

const MARK: Record<CurrencyCode, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

export default function SiteDoorBar({ tone = 'dark' }: { tone?: 'dark' | 'daylight' }) {
  const prefs = useDisplayPrefs();
  const light = tone === 'daylight' || true;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [query, setQuery] = useState('');
  const chip = light
    ? 'inline-flex min-h-[52px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-900 shadow-sm'
    : 'inline-flex min-h-[52px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-900';

  const openTools = () => setToolsOpen(true);
  useEffect(() => {
    const onToggle = () => setToolsOpen(true);
    window.addEventListener(SIDEBAR_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(SIDEBAR_TOGGLE_EVENT, onToggle);
  }, []);

  const finderLinks = [
    { href: '/owner/', label: 'Check My Money' },
    { href: '/workspace/documents/', label: 'Join & Fix PDF' },
    { href: '/workspace/image/', label: 'Passport & ID Photo' },
    { href: '/workspace/finance/', label: 'Loan & Shop Tools' },
    { href: '/seller/', label: 'Seller Hub' },
    { href: '/munshi/', label: 'Munshi Desk' },
    { href: '/workspace/quick-tools/', label: 'Quick Tools' },
  ].filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (!toolsOpen && !settingsOpen && !finderOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolsOpen(false);
        setSettingsOpen(false);
        setFinderOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finderOpen, settingsOpen, toolsOpen]);

  const speakFinder = () => {
    setFinderOpen(true);
    try {
      const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) return;
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = prefs.language === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.onresult = (event: { results: Array<Array<{ transcript: string }>> }) => {
        const text = event.results[0]?.[0]?.transcript || '';
        setQuery(text);
        const route = routeForSpokenTool(text);
        if (route) window.location.href = route.href;
      };
      recognition.start();
    } catch {
      speakText('Use the buttons in this list.', prefs.language);
    }
  };

  return (
    <>
      <div className="print:hidden flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className={chip} aria-label="All Tools" onClick={openTools}>☰ All Tools</button>
          <a href="/" className="truncate text-base font-black text-slate-900">GramSeva Mitra</a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className={chip}
            aria-pressed={prefs.simpleMode}
            onClick={() => {
              const next = !prefs.simpleMode;
              prefs.setSimpleMode(next);
              speakText(next ? 'Voice guide on. Tap a big card to hear it.' : 'Voice guide off.', prefs.language);
            }}
          >
            🔊 Voice Guide {prefs.simpleMode ? 'ON' : 'OFF'}
          </button>
          <button type="button" className={chip} onClick={speakFinder} aria-label="Speak a tool name">🎤 Speak</button>
        </div>
        <button type="button" className={chip} onClick={() => setSettingsOpen(true)} aria-label="Language digits and currency">
          🌐 {prefs.language.toUpperCase()} · {prefs.numerals === 'devanagari' ? '१२३' : '123'} · {MARK[prefs.currency]}
        </button>
      </div>

      {toolsOpen && (
        <div className="print:hidden fixed inset-0 z-50 bg-slate-900/40" role="dialog" aria-label="All Tools">
          <button type="button" className="absolute inset-0" aria-label="Close all tools" onClick={() => setToolsOpen(false)} />
          <aside className="relative h-full w-80 max-w-[88vw] overflow-y-auto bg-white p-4 text-slate-900 shadow-xl">
            <button type="button" className="min-h-[52px] font-black" onClick={() => setToolsOpen(false)}>✕ Close</button>
            <p className="mt-3 text-sm font-black">Roles</p>
            <a className="mt-2 flex min-h-[52px] items-center font-black" href="/owner/">🍽️ Owner App</a>
            <a className="flex min-h-[52px] items-center font-black" href="/seller/">📦 Seller Hub</a>
            <a className="flex min-h-[52px] items-center font-black" href="/munshi/">💼 Munshi Desk</a>
            <p className="mt-4 text-sm font-black">Studios</p>
            <a className="mt-2 flex min-h-[52px] items-center font-black" href="/workspace/finance/">💰 Finance Hub</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/documents/">📘 Document Studio</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/image/">🪪 Image Studio</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/video/">🎬 Video Studio</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/career/">🎯 Career Prep</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/lifestyle/">🧘 Health & Lifestyle</a>
            <a className="flex min-h-[52px] items-center font-black" href="/workspace/quick-tools/">⚡ Quick Tools</a>
          </aside>
        </div>
      )}

      {settingsOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-label="Language digits and currency">
          <div className="max-h-[84vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xl font-black">Language, digits, currency</p>
              <button type="button" className="min-h-[52px] px-3 text-lg font-black" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <p className="mt-4 text-sm font-black">Language</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {LANGUAGES.map((language) => (
                <button key={language.id} type="button" className="min-h-[52px] rounded-2xl border border-slate-200 bg-slate-50 font-black text-slate-900" onClick={() => { prefs.setLanguage(language.id); speakText(language.label, language.id); }}>
                  {language.label}
                </button>
              ))}
            </div>
            <p className="mt-4 text-sm font-black">Numbers</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="min-h-[52px] rounded-2xl border border-slate-200 font-black" onClick={() => prefs.setNumerals('latin')}>123</button>
              <button type="button" className="min-h-[52px] rounded-2xl border border-slate-200 font-black" onClick={() => prefs.setNumerals('devanagari')}>१२३</button>
            </div>
            <p className="mt-4 text-sm font-black">Currency</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CURRENCIES.map((currency) => (
                <button key={currency.id} type="button" className="min-h-[52px] rounded-2xl border border-slate-200 font-black" onClick={() => prefs.setCurrency(currency.id)}>
                  {currency.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {finderOpen && (
        <div className="print:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-label="Voice and tool search">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 text-slate-900 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-xl font-black">🎤 Speak or tap a tool</p>
              <button type="button" className="min-h-[52px] px-3 font-black" onClick={() => setFinderOpen(false)}>✕</button>
            </div>
            <input className="mt-3 min-h-[52px] w-full rounded-2xl border border-slate-300 px-3 text-slate-900" placeholder="Search tools" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="mt-3 grid gap-2">
              {finderLinks.map((item) => (
                <a key={item.href} className="min-h-[52px] rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-900" href={item.href}>{item.label}</a>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="print:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white lg:hidden" aria-label="Phone tools">
        <a className="min-h-[52px] px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/finance/">💰 Money</a>
        <a className="min-h-[52px] px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/documents/">📘 PDF</a>
        <a className="min-h-[52px] px-1 py-2 text-center text-xs font-black text-slate-900" href="/workspace/image/">🪪 Photo</a>
        <button type="button" className="min-h-[52px] px-1 py-2 text-center text-xs font-black text-slate-900" onClick={openTools}>☰ All Tools</button>
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
