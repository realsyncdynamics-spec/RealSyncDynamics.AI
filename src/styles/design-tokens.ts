/**
 * Design System Tokens
 * Central TypeScript-first design token definitions for RealSyncDynamics.AI
 * Used by components for type-safe, consistent styling
 */

export const COLORS = {
  primary: {
    obsidian: '#0A0A0B',
    titanium: '#E2E2E2',
  },
  accent: {
    petrol: '#0F766E',
    'security-blue': '#0052FF',
  },
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
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    sans: 'Inter, sans-serif',
    display: 'Space Grotesk, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
  } as const,
  lineHeight: {
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.75',
    loose: '2',
  } as const,
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  } as const,
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
} as const;

export const BORDER_RADIUS = {
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
} as const;

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  glass: '0 8px 32px rgba(31, 38, 135, 0.37)',
  'glow-petrol': '0 0 20px rgba(15, 118, 110, 0.3)',
  'glow-blue': '0 0 20px rgba(0, 82, 255, 0.3)',
} as const;

export const TRANSITIONS = {
  fast: '150ms',
  base: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

export const EASING = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const Z_INDEX = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modal: 1300,
  popover: 1400,
  tooltip: 1500,
} as const;

export const BREAKPOINTS = {
  xs: '0px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

/**
 * Button Variants
 */
export const BUTTON_VARIANTS = {
  primary: {
    bg: COLORS.accent['security-blue'],
    text: COLORS.primary.obsidian,
    hover: 'bg-blue-600',
    active: 'bg-blue-700',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  secondary: {
    bg: COLORS.accent.petrol,
    text: COLORS.primary.obsidian,
    hover: 'bg-teal-700',
    active: 'bg-teal-800',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  outline: {
    bg: 'transparent',
    text: COLORS.primary.titanium,
    border: `border border-${COLORS.primary.titanium}/30`,
    hover: `bg-${COLORS.primary.obsidian}/50 border-${COLORS.primary.titanium}/50`,
    disabled: 'opacity-50 cursor-not-allowed',
  },
  ghost: {
    bg: 'transparent',
    text: COLORS.primary.titanium,
    hover: `bg-${COLORS.primary.obsidian}/50`,
    disabled: 'opacity-50 cursor-not-allowed',
  },
  danger: {
    bg: COLORS.semantic.error,
    text: COLORS.primary.obsidian,
    hover: 'bg-red-600',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  success: {
    bg: COLORS.semantic.success,
    text: COLORS.primary.obsidian,
    hover: 'bg-green-600',
    disabled: 'opacity-50 cursor-not-allowed',
  },
} as const;

/**
 * Button Sizes
 */
export const BUTTON_SIZES = {
  xs: {
    padding: '4px 8px',
    fontSize: TYPOGRAPHY.fontSize.xs,
    height: '24px',
  },
  sm: {
    padding: '8px 12px',
    fontSize: TYPOGRAPHY.fontSize.sm,
    height: '32px',
  },
  md: {
    padding: '12px 16px',
    fontSize: TYPOGRAPHY.fontSize.base,
    height: '40px',
  },
  lg: {
    padding: '16px 24px',
    fontSize: TYPOGRAPHY.fontSize.lg,
    height: '48px',
  },
  xl: {
    padding: '20px 32px',
    fontSize: TYPOGRAPHY.fontSize.xl,
    height: '56px',
  },
} as const;

/**
 * Input Variants
 */
export const INPUT_VARIANTS = {
  outline: {
    border: `1px solid ${COLORS.primary.titanium}/30`,
    bg: 'transparent',
    focus: `border-${COLORS.accent['security-blue']} bg-${COLORS.primary.obsidian}/50`,
  },
  ghost: {
    border: 'none',
    bg: `${COLORS.primary.obsidian}/50`,
    focus: `bg-${COLORS.primary.obsidian}/80 ring-1 ring-${COLORS.accent['security-blue']}`,
  },
  filled: {
    border: 'none',
    bg: `${COLORS.primary.titanium}/10`,
    focus: `bg-${COLORS.primary.titanium}/20 ring-1 ring-${COLORS.accent['security-blue']}`,
  },
} as const;

/**
 * Card Variants
 */
export const CARD_VARIANTS = {
  default: {
    bg: COLORS.primary.obsidian,
    border: `1px solid ${COLORS.primary.titanium}/20`,
    borderRadius: BORDER_RADIUS.card,
  },
  elevated: {
    bg: `${COLORS.primary.obsidian}/80`,
    border: `1px solid ${COLORS.primary.titanium}/30`,
    borderRadius: BORDER_RADIUS.card,
    shadow: SHADOWS.lg,
  },
  glass: {
    bg: `${COLORS.primary.obsidian}/50`,
    border: `1px solid ${COLORS.primary.titanium}/20`,
    borderRadius: BORDER_RADIUS.card,
    backdropFilter: 'blur(8px)',
  },
  gradient: {
    bg: 'linear-gradient(135deg, rgba(15, 118, 110, 0.1) 0%, rgba(0, 82, 255, 0.05) 100%)',
    border: `1px solid ${COLORS.accent.petrol}/30`,
    borderRadius: BORDER_RADIUS.card,
  },
} as const;

/**
 * Helper: Get responsive class names
 */
export const getResponsiveClass = (mobile: string, tablet: string, desktop: string) => {
  return `${mobile} md:${tablet} lg:${desktop}`;
};

/**
 * Helper: Get glass effect class
 */
export const getGlassClass = (variant: 'default' | 'sm' | 'lg' | 'petrol' | 'blue' = 'default') => {
  return `glass${variant !== 'default' ? `-${variant}` : ''}`;
};

/**
 * Helper: Get gradient overlay class
 */
export const getGradientClass = (type: 'overlay' | 'mesh' | 'petrol-blue' = 'overlay') => {
  return `gradient-${type}`;
};

export type ColorKeys = keyof typeof COLORS;
export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;
export type InputVariant = keyof typeof INPUT_VARIANTS;
export type CardVariant = keyof typeof CARD_VARIANTS;
export type SpacingKey = keyof typeof SPACING;
