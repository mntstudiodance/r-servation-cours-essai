/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stage: {
          black: '#0a0908',
          charcoal: '#161311',
          curtain: '#1f1a17',
        },
        magenta: {
          DEFAULT: '#c2185b',
          bright: '#e91e63',
          deep: '#8e0e42',
        },
        gold: {
          DEFAULT: '#d4af37',
          soft: '#e8ce7d',
          dim: '#8a6f22',
        },
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(194, 24, 91, 0.35)',
        goldglow: '0 0 30px rgba(212, 175, 55, 0.25)',
      },
      keyframes: {
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(16px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        spotPulse: {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
      },
      animation: {
        riseIn: 'riseIn 0.5s ease-out both',
        spotPulse: 'spotPulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
