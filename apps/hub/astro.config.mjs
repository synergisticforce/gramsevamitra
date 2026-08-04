import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import {
  isIndexableRoute,
  normalizeSitemapPath,
  sitemapChangefreq,
  sitemapPriority,
} from './src/config/indexableRoutes.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  site: 'https://gramsevamitra.com',
  output: 'static',
  // Explicit directory + trailing slash so Capacitor always has .../index.html to open.
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    tailwind({ configFile: '../../packages/shared/tailwind.config.mjs' }),
    react(),
    sitemap({
      filter: (page) => isIndexableRoute(page),
      serialize(item) {
        const path = normalizeSitemapPath(item.url);
        return {
          ...item,
          priority: sitemapPriority(path),
          changefreq: sitemapChangefreq(path),
        };
      },
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'robots.txt', 'pwa-192.png', 'pwa-512.png', 'manifest.json'],
      // Single source of truth is the committed apps/hub/public/manifest.json,
      // which is the file every page links and the Android APK bundles.
      // Generating a second /manifest.webmanifest here only caused drift.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,txt,mjs,map,json}'],
        globIgnores: ['**/data/babyNames.json'],
        navigateFallback: '/offline/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/404\//, /^\/offline/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/auth/'),
            handler: 'NetworkOnly',
          },
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
            // The FFmpeg engine is a 32 MB one-time download; cache it so video
            // tools keep working offline after the first successful use.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@ffmpeg\/core@.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ffmpeg-core-cache',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            // Tesseract OCR worker, wasm core, and language data.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(tesseract\.js|@tesseract\.js-data).*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cache',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
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
      alias: {
        '@shared': sharedRoot,
        'pdf-lib': '@cantoo/pdf-lib',
      },
    },
    optimizeDeps: {
      include: ['browser-image-compression', '@huggingface/transformers', '@cantoo/pdf-lib', 'pdfjs-dist', 'compromise'],
      exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
    },
    worker: {
      format: 'es',
    },
  },
});
