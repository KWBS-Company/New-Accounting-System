/** @type {import('tailwindcss').Config} */
//
// Tailwind config — wired to CSS variables defined in src/index.css.
// To change theme tokens (light/dark colors), edit src/index.css.
// To change brand colors or fonts, edit src/lib/theme.ts.
//
import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // shadcn-style tokens driven by CSS vars (light + dark from index.css)
        border:      'hsl(var(--border))',
        input:       'hsl(var(--input))',
        ring:        'hsl(var(--ring))',
        background:  'hsl(var(--background))',
        foreground:  'hsl(var(--foreground))',
        primary: {
          DEFAULT:     'hsl(var(--primary))',
          foreground:  'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT:     'hsl(var(--secondary))',
          foreground:  'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:     'hsl(var(--destructive))',
          foreground:  'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:     'hsl(var(--muted))',
          foreground:  'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:     'hsl(var(--accent))',
          foreground:  'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:     'hsl(var(--popover))',
          foreground:  'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:     'hsl(var(--card))',
          foreground:  'hsl(var(--card-foreground))',
        },

        // ---- Legacy palette (kept so existing class names still render) ----
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
        emerald_ledger: {
          50:  '#EDF3F0',
          100: '#D5E3DC',
          400: '#3F7560',
          500: '#1E4D3F',
          600: '#163A30',
          700: '#102B24',
        },
        claret: {
          500: '#8B2C2C',
          600: '#6E2222',
        },
        sand: '#D9D1C0',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
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
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
