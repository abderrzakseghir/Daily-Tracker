import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        surface: 'var(--surface)',
        accent: {
          DEFAULT: '#6366F1',
          light: '#818CF8',
          dark: '#4F46E5',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#34D399',
          dark: '#059669',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#D97706',
        },
        error: {
          DEFAULT: '#EF4444',
          light: '#F87171',
          dark: '#DC2626',
        },
        // Hex (et non var CSS) pour garder les modificateurs d'opacité : bg-muted/10
        muted: {
          DEFAULT: '#7B8190',
          foreground: '#9CA3AF',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border: 'var(--border)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 17, 21, 0.04), 0 4px 16px -4px rgba(15, 17, 21, 0.06)',
        card: '0 0 0 1px rgba(15, 17, 21, 0.03), 0 2px 4px rgba(15, 17, 21, 0.04), 0 12px 32px -8px rgba(15, 17, 21, 0.12)',
        glow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-soft': 'pulseSoft 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
