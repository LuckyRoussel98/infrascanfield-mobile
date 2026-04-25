/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Black & white minimalist palette ; only metric colors are accents.
        background: {
          DEFAULT: '#ffffff',
          dark: '#0a0a0a',
        },
        surface: {
          DEFAULT: '#f5f5f5',
          dark: '#171717',
        },
        border: {
          DEFAULT: '#e5e5e5',
          dark: '#262626',
        },
        text: {
          DEFAULT: '#0a0a0a',
          muted: '#737373',
          dark: '#fafafa',
          'muted-dark': '#a3a3a3',
        },
        // Status accents (use sparingly, only for metier badges)
        success: '#16a34a',
        warning: '#ca8a04',
        danger: '#dc2626',
        info: '#2563eb',
      },
      fontFamily: {
        sans: ['System'],
        mono: ['Courier'],
      },
      spacing: {
        // Larger touch targets for fast field usage
        'touch-min': '44px',
      },
    },
  },
  plugins: [],
};
