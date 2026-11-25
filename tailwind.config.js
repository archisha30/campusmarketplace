/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Campus Market tokens (design handoff, "Mix 2"). Blue leads, yellow highlights.
      colors: {
        bg: '#F7F6F2',
        paper: '#FFFFFF',
        ink: { DEFAULT: '#16161D', soft: '#5B5B6B', faint: '#6B6B7A' },
        line: { DEFAULT: '#E4E2DA', strong: '#D9D6CE', soft: '#ECEAE2' },
        brand: { DEFAULT: '#2F4BFF', deep: '#2440E6', tint: '#EEF1FF' },
        sun: '#FFD447',
        whatsapp: '#25D366',
        leaf: '#166534',
        coral: '#B42318', // errors, sold, destructive actions
        tile: '#EFEDE6', // behind missing photos and previews
        skeleton: '#ECE9E2',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      // control: buttons, chips, inputs, small tiles. card / slab: cards and panels.
      borderRadius: { control: '12px', pill: '12px', card: '20px', slab: '20px' },
      // Section rhythm: multiples of 32 on top of Tailwind's 4/8/16/24/32.
      spacing: { section: '96px', 'section-sm': '64px' },
      maxWidth: { wrap: '1216px' },
      boxShadow: {
        btn: '0 12px 24px -12px rgba(22,22,29,.45)', // hover only
        lift: '0 18px 36px -20px rgba(22,22,29,.35)', // hover only
      },
      // `transition` also covers the hover lift (translate / scale, see index.css).
      transitionProperty: {
        DEFAULT: 'color, background-color, border-color, fill, stroke, opacity, box-shadow, transform, translate, scale',
      },
      transitionDuration: { DEFAULT: '250ms' },
      transitionTimingFunction: { DEFAULT: 'cubic-bezier(.2,.8,.2,1)' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(-2px)' }, '100%': { opacity: '1', transform: 'none' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
      animation: { skeleton: 'pulseSoft 1.6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
