const SITE_KEY = '0x4AAAAAADkEvAfoc0ocjgR2';

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  execute: (id: string) => void;
}

/** Invisible Cloudflare Turnstile token. Empty string if the widget cannot start. */
export function getTurnstileToken(): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve('');

  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };
    window.setTimeout(() => finish(''), 8000);

    const render = () => {
      const turnstile = (window as Window & { turnstile?: TurnstileApi }).turnstile;
      if (!turnstile) {
        window.setTimeout(render, 200);
        return;
      }
      const host = document.createElement('div');
      host.hidden = true;
      document.body.appendChild(host);
      const id = turnstile.render(host, {
        sitekey: SITE_KEY,
        size: 'invisible',
        callback: (token: string) => {
          host.remove();
          finish(token);
        },
        'error-callback': () => {
          host.remove();
          finish('');
        },
      });
      turnstile.execute(id);
    };

    const existing = document.querySelector('script[data-gsm-turnstile]');
    if (existing) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.gsmTurnstile = '1';
    script.onload = () => render();
    script.onerror = () => finish('');
    document.head.appendChild(script);
  });
}
