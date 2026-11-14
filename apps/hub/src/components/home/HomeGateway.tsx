import { SIDEBAR_TOGGLE_EVENT } from '../../lib/app/shellEvents';
import { useDisplayPrefs } from '../../lib/audit/useDisplayPrefs';
import { speakText } from '../../lib/voiceAssist';

const DOORS = [
  {
    href: '/owner/',
    tone: 'bg-emerald-600',
    visual: '💰  Swiggy · Zomato · Meesho · Flipkart · 🌍',
    title: 'Check My Money',
    hindi: 'पैसे की जांच करें',
    speech: 'Check my money. Upload a Swiggy, Zomato, Meesho, Flipkart, Amazon, or other payout file.',
  },
  {
    href: '/workspace/documents/',
    tone: 'bg-blue-600',
    visual: '📄 + 📄 ➔ 📘',
    title: 'Join & Fix PDF',
    hindi: 'पीडीएफ जोड़ें / छोटा करें',
    speech: 'Join and fix PDF. Merge, shrink, or convert a document.',
  },
  {
    href: '/workspace/image/',
    tone: 'bg-orange-500',
    visual: '🧑 ➔ 🪪 8 Photos',
    title: 'Passport & ID Photo',
    hindi: 'पासपोर्ट फोटो बनाएं',
    speech: 'Passport and ID photo. Make eight photos on one sheet, or shrink a photo under 100 KB.',
  },
  {
    href: '/workspace/finance/',
    tone: 'bg-violet-600',
    visual: '🧮 EMI · 📒 व्याज · 📦 4×6',
    title: 'Loan & Shop Tools',
    hindi: 'ब्याज और दुकान टूल्स',
    speech: 'Loan and shop tools. Check EMI, moneylender interest, and a 4 by 6 shipping label.',
  },
] as const;

export default function HomeGateway() {
  const prefs = useDisplayPrefs();

  return (
    <section className="bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          className="min-h-[52px] w-full rounded-full bg-white px-4 text-sm font-black shadow-sm"
          onClick={() => speakText('Tap any big card to hear it in your language.', prefs.language)}
        >
          🔊 Tap any big card to hear it in your language · किसी भी बड़े बटन को दबाकर सुनें
        </button>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {DOORS.map((door) => (
            <a key={door.href} href={door.href} className={`flex min-h-44 flex-col justify-between rounded-3xl p-5 text-white shadow-sm ${door.tone}`}>
              <p className="text-2xl font-black">{door.visual}</p>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-3xl font-black">{door.title}</p>
                  <p className="text-lg font-bold">{door.hindi}</p>
                </div>
                <button
                  type="button"
                  className="min-h-[52px] rounded-full bg-white px-4 text-lg font-black text-slate-900"
                  aria-label={`Listen: ${door.title}`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    speakText(door.speech, prefs.language);
                  }}
                >
                  🔊
                </button>
              </div>
            </a>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a className="min-h-[52px] rounded-full bg-white px-4 py-3 text-center text-sm font-black shadow-sm" href="/munshi/">
            💼 Accountant / Munshi Desk (50-Client Bulk Tally Export) →
          </a>
          <button
            type="button"
            className="min-h-[52px] rounded-full bg-white px-4 py-3 text-sm font-black shadow-sm"
            onClick={() => window.dispatchEvent(new Event(SIDEBAR_TOGGLE_EVENT))}
          >
            ⚡ Open All 60+ Free Calculators & Studios →
          </button>
        </div>
      </div>
    </section>
  );
}
