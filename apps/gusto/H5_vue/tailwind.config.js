/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#FF6B35',
          yellow: '#F2C14E',
          dark: '#0A0A0A',
          surface: '#1A1A1A',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Noto Serif SC"', 'sans-serif'],
        serif: ['"Libre Baskerville"', '"Noto Serif SC"', 'serif'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(255, 107, 53, 0.15)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(40px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'blur-in': {
          from: { opacity: '0', filter: 'blur(10px)', transform: 'scaleY(1.2) translateY(20px)' },
          to: { opacity: '1', filter: 'blur(0)', transform: 'scaleY(1) translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.8s ease-out forwards',
        'scale-in': 'scale-in 0.8s ease-out forwards',
        'blur-in': 'blur-in 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}
