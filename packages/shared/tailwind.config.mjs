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
          bg: '#F8FAFC',
          surface: '#FFFFFF',
          elevated: '#F1F5F9',
          border: '#E2E8F0',
          'border-subtle': '#E2E8F0',
          text: '#0F172A',
          muted: '#334155',
          subtle: '#475569',
          accent: '#15803D',
          'accent-hover': '#166534',
          'accent-muted': '#DCFCE7',
          'accent-soft': '#F0FDF4',
          danger: '#B91C1C',
          'danger-soft': '#FEF2F2',
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
