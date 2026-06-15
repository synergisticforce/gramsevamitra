/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
    '../../packages/shared/src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        canvas: {
          bg: '#f1f5f9',
          surface: '#ffffff',
          border: '#cbd5e1',
          accent: '#64748b',
          'accent-muted': '#94a3b8',
        },
      },
      animation: {
        'gauge-fill': 'gauge-fill 1.2s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
      keyframes: {
        'gauge-fill': {
          from: { strokeDashoffset: '283' },
          to: { strokeDashoffset: 'var(--gauge-offset)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
