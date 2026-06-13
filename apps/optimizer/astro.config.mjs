import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { createPwaPlugin } from '../../packages/shared/src/config/pwa.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(__dirname, '../../packages/shared/src');

export default defineConfig({
  site: 'https://optimizer.gramsevamitra.com',
  output: 'static',
  integrations: [
    tailwind({ configFile: '../../packages/shared/tailwind.config.mjs' }),
    react(),
    sitemap(),
  ],
  vite: {
    resolve: {
      alias: { '@shared': sharedRoot },
    },
    plugins: [
      createPwaPlugin({
        name: 'Exam Document Optimizer — GramSeva Mitra',
        shortName: 'Doc Optimizer',
        description: 'Resize exam photos and signatures for SSC, UPSC, RRB, IBPS',
        navigateFallback: '/404.html',
      }),
    ],
    optimizeDeps: {
      include: ['browser-image-compression', 'jszip', 'react', 'react-dom'],
    },
  },
});
