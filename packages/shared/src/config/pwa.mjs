import { VitePWA } from 'vite-plugin-pwa';

/**
 * @param {{
 *   name: string;
 *   shortName: string;
 *   description: string;
 *   themeColor?: string;
 *   navigateFallback?: string;
 *   maximumFileSizeToCacheInBytes?: number;
 * }} options
 */
export function createPwaPlugin(options) {
  return VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'robots.txt', 'pwa-192.png', 'pwa-512.png'],
    manifest: {
      name: options.name,
      short_name: options.shortName,
      description: options.description,
      theme_color: options.themeColor ?? '#020617',
      background_color: '#020617',
      display: 'standalone',
      orientation: 'portrait-primary',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/pwa-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/pwa-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/pwa-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest,txt,mjs,map,json}'],
      ...(options.navigateFallback
        ? {
            navigateFallback: options.navigateFallback,
            navigateFallbackDenylist: [/^\/api\//],
          }
        : {}),
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: options.maximumFileSizeToCacheInBytes ?? 2 * 1024 * 1024,
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
    devOptions: {
      enabled: false,
    },
    ...(options.navigateFallback
      ? {
          experimental: {
            directoryAndTrailingSlashHandler: true,
          },
        }
      : {}),
  });
}
