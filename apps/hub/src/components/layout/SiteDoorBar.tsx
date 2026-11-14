import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';

const DOORS = [
  { href: '/owner/', label: 'Owner App', emoji: '🍽️' },
  { href: '/seller/', label: 'Seller Hub', emoji: '📦' },
  { href: '/munshi/', label: 'Munshi Desk', emoji: '💼' },
  { href: '/workspace/finance/', label: 'Finance Hub', emoji: '💰' },
  { href: '/workspace/documents/', label: 'Documents', emoji: '⚡' },
  { href: '/workspace/image/', label: 'Images', emoji: '🖼️' },
  { href: '/workspace/video/', label: 'Video', emoji: '🎬' },
  { href: '/workspace/career/', label: 'Career', emoji: '🎯' },
  { href: '/workspace/quick-tools/', label: 'Quick Tools', emoji: '🧰' },
] as const;

export default function SiteDoorBar({ tone = 'dark' }: { tone?: 'dark' | 'daylight' }) {
  const prefs = useDisplayPrefs();
  const light = tone === 'daylight';
  const linkClass = light
    ? 'shrink-0 rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900'
    : 'shrink-0 rounded-full border border-canvas-border px-3 py-2 text-sm font-semibold text-slate-100';
  const toggleClass = light
    ? 'rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-900'
    : 'rounded-full border border-canvas-border px-3 py-2 text-sm font-semibold text-slate-100';

  return (
    <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4">
      <nav className="flex min-w-0 flex-1 gap-2" aria-label="Quick jump">
        {DOORS.map((door) => (
          <a key={door.href} href={door.href} className={linkClass}>
            <span aria-hidden="true">{door.emoji} </span>
            {door.label}
          </a>
        ))}
      </nav>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className={toggleClass}
          aria-label={prefs.language === 'hi' ? 'Switch language to English' : 'भाषा हिंदी में बदलें'}
          onClick={() => prefs.setLanguage(prefs.language === 'hi' ? 'en' : 'hi')}
        >
          {prefs.language === 'hi' ? 'हिंदी' : 'EN'}
        </button>
        <button
          type="button"
          className={toggleClass}
          aria-label={prefs.numerals === 'devanagari' ? 'Switch numerals to 123' : 'अंक १२३ में बदलें'}
          onClick={() => prefs.setNumerals(prefs.numerals === 'devanagari' ? 'latin' : 'devanagari')}
        >
          {prefs.numerals === 'devanagari' ? '१२३' : '123'}
        </button>
      </div>
    </div>
  );
}
