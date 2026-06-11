import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import { createPwaPlugin } from '../../packages/shared/src/config/pwa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  site: 'https://pdf.gramsevamitra.com',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    tailwind({ configFile: '../../packages/shared/tailwind.config.mjs' }),
    react(),
  ],
  vite: {
    build: {
      chunkSizeWarningLimit: 2500,
    },
    resolve: {
      alias: {
        '@shared': sharedRoot,
        'pdf-lib': '@cantoo/pdf-lib',
      },
    },
    plugins: [
      createPwaPlugin({
        name: 'PDF Tools — GramSeva Mitra',
        shortName: 'PDF Tools',
        description:
          'Free PDF compress, merge, split, watermark, sign, and unlock — professional document utilities that run privately in your browser',
        navigateFallback: '/404.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }),
    ],
    optimizeDeps: {
      include: [
        '@cantoo/pdf-lib',
        'pdfjs-dist',
        'react',
        'react-dom',
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@dnd-kit/utilities',
        'jszip',
        'sortablejs',
      ],
    },
    worker: {
      format: 'es',
    },
  },
});
