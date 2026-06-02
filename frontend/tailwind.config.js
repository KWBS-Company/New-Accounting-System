/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm parchment base
        parchment: {
          50:  '#FBF8F1',
          100: '#F5F1E8',
          200: '#EDE6D3',
          300: '#E0D5BB',
          400: '#C9B98F',
        },
        ink: {
          900: '#16140F',
          800: '#1F1C16',
          700: '#2F2A22',
          600: '#4A4339',
          500: '#6B6358',
          400: '#8B8275',
          300: '#A89F90',
        },
        // Deep emerald accent — the ledger's signature
        emerald_ledger: {
          50:  '#EDF3F0',
          100: '#D5E3DC',
          400: '#3F7560',
          500: '#1E4D3F',
          600: '#163A30',
          700: '#102B24',
        },
        // Reserved claret for debit/credit and danger
        claret: {
          500: '#8B2C2C',
          600: '#6E2222',
        },
        sand: '#D9D1C0',
      },
      fontFamily: {
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(31, 28, 22, 0.04), 0 8px 24px -12px rgba(31, 28, 22, 0.12)',
        inset_line: 'inset 0 -1px 0 rgba(31,28,22,0.08)',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
}
