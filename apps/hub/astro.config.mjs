import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, '../../packages/shared/src');
const UTILITIES_ORIGIN = 'https://utilities.gramsevamitra.com';

export default defineConfig({
  site: 'https://gramsevamitra.com',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({ configFile: '../../packages/shared/tailwind.config.mjs' }),
    react(),
    sitemap(),
    AstroPWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'GramSeva Mitra Utilities',
        short_name: 'Utilities',
        description: 'Your free global document and productivity toolkit — offline calculators, trackers, and career tools.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: `${UTILITIES_ORIGIN}/`,
        start_url: `${UTILITIES_ORIGIN}/tools`,
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
        globIgnores: ['**/data/babyNames.json'],
        navigateFallback: '/offline/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/404\.html$/, /^\/offline/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/data/') && url.pathname.endsWith('.json'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'hub-data-json',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
      experimental: {
        directoryAndTrailingSlashHandler: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  vite: {
    resolve: {
      alias: { '@shared': sharedRoot },
    },
    optimizeDeps: {
      include: ['browser-image-compression', '@huggingface/transformers', 'pdf-lib'],
    },
    worker: {
      format: 'es',
    },
  },
});
