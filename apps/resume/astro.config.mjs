import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import { createPwaPlugin } from '../../packages/shared/src/config/pwa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  site: 'https://resume.gramsevamitra.com',
  output: 'static',
  integrations: [
    tailwind({ configFile: '../../packages/shared/tailwind.config.mjs' }),
    react(),
  ],
  vite: {
    resolve: {
      alias: { '@shared': sharedRoot },
    },
    plugins: [
      createPwaPlugin({
        name: 'ATS Resume Scanner — GramSeva Mitra',
        shortName: 'Resume Scanner',
        description: 'ATS match score and keyword analysis for job applications',
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      }),
    ],
    optimizeDeps: {
      include: ['pdfjs-dist', 'react', 'react-dom'],
    },
    worker: {
      format: 'es',
    },
  },
});
