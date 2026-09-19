/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F6F2',
        paper: '#FFFFFF',
        ink: { DEFAULT: '#15181F', soft: '#565B68', faint: '#8A8F9B' },
        line: '#E4E3DC',
        brand: { DEFAULT: '#2F4CFF', deep: '#1E33CC', tint: '#EEF0FF' },
        sun: '#FFD23F',
        leaf: '#1F8B4C',
        coral: '#FF5A44',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px', pill: '999px', slab: '26px' },
      boxShadow: {
        lift: '0 1px 2px rgba(21,24,31,.04), 0 8px 24px rgba(21,24,31,.06)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '100% 0' }, '100%': { backgroundPosition: '0 0' } },
      },
      animation: { shimmer: 'shimmer 1.3s ease infinite' },
    },
  },
  plugins: [],
}
