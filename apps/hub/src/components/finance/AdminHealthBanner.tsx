import { useEffect, useState } from 'react';

interface HealthReport {
  razorpayMode?: string;
  databaseConfigured?: boolean;
  aiProvidersConfigured?: { gemini?: boolean; sarvam?: boolean; azureDocIntel?: boolean };
}

export default function AdminHealthBanner() {
  const [health, setHealth] = useState<HealthReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/health')
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch(() => {
        if (!cancelled) setHealth({ razorpayMode: 'UNCONFIGURED' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const live = health?.razorpayMode === 'LIVE';
  const providers = health?.aiProvidersConfigured;
  return (
    <div className={`px-4 py-4 text-slate-950 ${live ? 'bg-emerald-400' : 'bg-amber-400'}`}>
      <p className="text-xl font-black sm:text-2xl">
        {live
          ? '🟢 RAZORPAY LIVE MODE ACTIVE — Real UPI & Mandate Payments Enabled'
          : '🟠 RAZORPAY TEST MODE ACTIVE (₹0 Real Money) — Swap rzp_live_ keys in Cloudflare Pages Settings to collect real payments'}
      </p>
      <p className="mt-2 text-sm font-bold">
        Neon {health?.databaseConfigured ? 'connected' : 'not set'}
        {' · '}Gemini {providers?.gemini ? 'on' : 'off'}
        {' · '}Sarvam {providers?.sarvam ? 'on' : 'off'}
        {' · '}Azure {providers?.azureDocIntel ? 'on' : 'off'}
      </p>
    </div>
  );
}
