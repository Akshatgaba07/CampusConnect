/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0c1626', 900: '#111f35', 800: '#1a2c47', 600: '#3c4f6e', 400: '#7686a3', 200: '#c9d1e0', 100: '#e4e9f2', 50: '#f1f4f9' },
        brand: { DEFAULT: '#d6303a', dark: '#b3222c', soft: '#fdeced' },
        ok: { DEFAULT: '#12805c', soft: '#e3f5ee' },
        warn: { DEFAULT: '#a15c07', soft: '#fdf1dc' },
      },
      fontFamily: { display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'], sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
