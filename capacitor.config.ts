import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Production Android/iOS shell — loads bundled `webDir` assets only.
 * Do NOT set `server.url` here: that forces a live-site load and often opens Chrome.
 */
const config: CapacitorConfig = {
  appId: 'com.gramsevamitra.app',
  appName: 'GramsevaMitra',
  webDir: 'apps/hub/dist',
  server: {
    androidScheme: 'https',
    // Keep OAuth / checkout navigations inside the WebView when needed.
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
      // Native HTTP so /api calls can reach Cloudflare from the local WebView origin.
      enabled: true,
    },
  },
};

export default config;
