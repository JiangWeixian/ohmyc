import typography from '@tailwindcss/typography'
import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground, var(--foreground)))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        tremor: {
          brand: {
            faint: '#191a1b',
            muted: '#28282c',
            subtle: '#62666d',
            DEFAULT: '#f7f8f8',
            emphasis: '#f7f8f8',
            inverted: '#08090a',
          },
          background: {
            muted: '#0f1011',
            subtle: '#191a1b',
            DEFAULT: '#08090a',
            emphasis: '#f7f8f8',
          },
          border: { DEFAULT: 'rgba(255,255,255,0.08)' },
          ring: { DEFAULT: '#23252a' },
          content: {
            subtle: '#62666d',
            DEFAULT: '#8a8f98',
            emphasis: '#d0d6e0',
            strong: '#f7f8f8',
            inverted: '#08090a',
          },
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    typography,
  ],
}
