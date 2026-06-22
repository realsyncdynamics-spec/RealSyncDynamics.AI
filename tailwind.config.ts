import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0A0B',
        titanium: '#E2E2E2',
        'security-blue': '#0052FF',
        petrol: '#0F766E',
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '52px' }],
        '6xl': ['60px', { lineHeight: '66px' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'glass': '0 8px 32px rgba(31, 38, 135, 0.37)',
        'glow-petrol': '0 0 20px rgba(15, 118, 110, 0.3)',
        'glow-blue': '0 0 20px rgba(0, 82, 255, 0.3)',
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      borderRadius: {
        none: '0px',
        xs: '2px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '20px',
        chip: '20px',
        card: '10px',
        panel: '12px',
        full: '9999px',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '500ms',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glass-shimmer': 'glass-shimmer 3s linear infinite',
        'gradient-shift': 'gradient-shift 3s ease infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'glass-shimmer': {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'gradient-shift': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
    },
  },
  plugins: [
    function({ addUtilities }: any) {
      const glassUtilities = {
        '.glass': {
          '@apply backdrop-blur-md bg-obsidian/50 border border-titanium/20': {},
        },
        '.glass-sm': {
          '@apply backdrop-blur-sm bg-obsidian/40 border border-titanium/10': {},
        },
        '.glass-lg': {
          '@apply backdrop-blur-lg bg-obsidian/60 border border-titanium/30': {},
        },
        '.glass-petrol': {
          '@apply backdrop-blur-md bg-petrol/10 border border-petrol/30': {},
        },
        '.glass-blue': {
          '@apply backdrop-blur-md bg-security-blue/10 border border-security-blue/30': {},
        },
      };

      const gradientUtilities = {
        '.gradient-petrol-blue': {
          backgroundImage: 'linear-gradient(135deg, #0F766E 0%, #0052FF 100%)',
        },
        '.gradient-overlay': {
          backgroundImage: 'linear-gradient(135deg, rgba(15, 118, 110, 0.2) 0%, rgba(0, 82, 255, 0.1) 100%)',
        },
        '.gradient-mesh': {
          backgroundImage: `
            radial-gradient(at 20% 50%, rgba(15, 118, 110, 0.2) 0px, transparent 50px),
            radial-gradient(at 80% 80%, rgba(0, 82, 255, 0.1) 0px, transparent 50px)
          `,
        },
      };

      addUtilities({ ...glassUtilities, ...gradientUtilities });
    },
  ],
} satisfies Config;
