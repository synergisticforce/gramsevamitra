import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Production Android/iOS shell — loads bundled `webDir` assets only.
 * Do NOT set `server.url` (that forces a live-site load / Chrome handoff).
 */
const config: CapacitorConfig = {
  appId: 'com.gramsevamitra.app',
  appName: 'GramsevaMitra',
  webDir: 'apps/hub/dist',
  server: {
    // https://localhost via WebViewAssetLoader — root-absolute /_astro/* paths resolve correctly.
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      'gramsevamitra.com',
      '*.gramsevamitra.com',
      'accounts.google.com',
      '*.google.com',
      'checkout.razorpay.com',
      '*.razorpay.com',
      'api.razorpay.com',
    ],
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
