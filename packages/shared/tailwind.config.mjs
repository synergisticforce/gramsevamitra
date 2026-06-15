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
          bg: '#121214',
          surface: '#1a1a1e',
          elevated: '#222226',
          border: '#2a2a30',
          'border-subtle': '#232328',
          text: '#d4d4d8',
          muted: '#a0aec0',
          subtle: '#6b7280',
          accent: '#6b8f71',
          'accent-hover': '#7a9a80',
          'accent-muted': '#3d5242',
          'accent-soft': '#2a332c',
          danger: '#9a6b6b',
          'danger-soft': '#3d2f2f',
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
