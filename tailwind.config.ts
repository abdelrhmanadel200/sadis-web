import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        // Legacy app theme (kept for /chat, /profile, etc.)
        'dark-bg': '#121212',
        'dark-surface': '#1E1E1E',
        'dark-card': '#202020',
        'dark-input': '#282828',
        'dark-border': '#373737',
        'dark-text': '#FFFFFF',
        // Brighter secondary so muted copy stays legible on the deep slate
        // landing background (--background: 230 25% 8%, even darker than the
        // legacy #121212). #B8B8B8 has ~7:1 contrast on that bg.
        'dark-text-secondary': '#B8B8B8',
        'dark-text-tertiary': '#8A8A8A',
        'light-bg': '#F5F5F5',
        'light-surface': '#EBEBEB',
        'light-card': '#DCDCDC',
        'light-input': '#D9D9D9',
        'light-border': '#BEBEBE',
        'light-text': '#131313',
        'light-text-secondary': '#505050',
        'light-text-tertiary': '#7D7D7D',
        'primary-light': '#1EA0D1',
        success: '#34A853',
        error: '#EA4335',
        warning: '#FBBC05',
        info: '#4285F4',
        // v0 / shadcn token system used by the new Landing components.
        // These map to CSS variables we set in globals.css so dark/light
        // themes can drive them.
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
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        cairo: ['var(--font-cairo)', 'sans-serif'],
        tajawal: ['var(--font-tajawal)', 'sans-serif'],
        mulish: ['var(--font-mulish)', 'sans-serif'],
        sans: ['var(--font-cairo)', 'var(--font-tajawal)', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
