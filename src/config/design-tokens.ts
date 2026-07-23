/**
 * Unified Design Tokens for RealSyncDynamics.AI
 *
 * Single source of truth for all design decisions:
 * - Color palettes per context (landing, flow, dashboard)
 * - Button hierarchy (Primary, Secondary, Tertiary)
 * - Semantic colors (success, error, warning)
 * - Spacing and typography scale
 *
 * This ensures consistent visual hierarchy and emotional guidance
 * across all user journeys.
 */

/**
 * Context-based color palettes
 * Each context (public landing, audit-flow, dashboard) has distinct colors
 * to help users understand where they are in the journey
 */
export const CONTEXT_COLORS = {
  /** Public landing pages — welcoming, soft, professional */
  landing: {
    /** Petrol #0F766E — trust, governance, professional */
    accent: 'petrol-700',
    /** Slate-900 — text on light backgrounds */
    text: 'slate-900',
    /** White/light backgrounds for friendly feel */
    background: 'white',
    /** Slate secondary accent */
    secondary: 'slate-600',
  },

  /** Audit-flow — progressive, warm, forward momentum */
  flow: {
    /** Gold #F5B324 — warm, progress, action-oriented */
    accent: 'gold-500',
    /** Obsidian-950 — dark, professional, serious */
    background: 'obsidian-950',
    /** Titanium-400 — secondary actions */
    secondary: 'titanium-400',
    /** White text for contrast on dark */
    text: 'white',
  },

  /** Dashboard/workspace — authoritative, secure, professional */
  dashboard: {
    /** Security-Blue #0052FF — trust, authority, compliance */
    accent: 'security-blue-500',
    /** Obsidian-950 — consistent dark enterprise UI */
    background: 'obsidian-950',
    /** Titanium-100 — light text on dark background */
    text: 'titanium-100',
    /** Titanium-400 — secondary actions */
    secondary: 'titanium-400',
  },
} as const;

/**
 * Button hierarchy — guides users to right action
 * Primary > Secondary > Tertiary
 */
export const BUTTON_HIERARCHY = {
  /** Hero/primary CTA — most important action, highest contrast */
  primary: {
    bg: 'gold-500',
    text: 'obsidian-950',
    intent: 'hero-cta' as const,
    hoverBg: 'gold-600',
  },

  /** Secondary action — supports primary, secondary importance */
  secondary: {
    bg: 'titanium-200',
    text: 'obsidian-950',
    intent: 'support' as const,
    hoverBg: 'titanium-300',
  },

  /** Tertiary/optional — minimal, low-importance, text-based */
  tertiary: {
    bg: 'transparent',
    border: 'titanium-400',
    text: 'titanium-400',
    intent: 'optional' as const,
    hoverBg: 'titanium-100',
  },
} as const;

/**
 * Semantic colors — status, severity, outcome
 * Consistent across all contexts
 */
export const SEMANTIC_COLORS = {
  success: {
    color: 'emerald-500',
    bg: 'emerald-50',
    border: 'emerald-200',
  },
  error: {
    color: 'red-500',
    bg: 'red-50',
    border: 'red-200',
  },
  warning: {
    color: 'amber-500',
    bg: 'amber-50',
    border: 'amber-200',
  },
  info: {
    color: 'blue-500',
    bg: 'blue-50',
    border: 'blue-200',
  },
  neutral: {
    color: 'titanium-400',
    bg: 'titanium-100',
    border: 'titanium-300',
  },
} as const;

/**
 * Risk/Compliance Severity Colors
 * Maps compliance risk levels to visual severity
 */
export const RISK_SEVERITY = {
  critical: 'red-600',
  high: 'orange-500',
  medium: 'amber-500',
  low: 'teal-500',
  passed: 'green-500',
} as const;

/**
 * Typography scale
 * Ensures consistent hierarchy across all pages
 */
export const TYPOGRAPHY = {
  display: {
    // Hero titles (landing pages)
    xl: 'text-6xl font-display font-bold',
    lg: 'text-5xl font-display font-bold',
    base: 'text-4xl font-display font-bold',
  },
  heading: {
    // Section headings
    lg: 'text-3xl font-semibold',
    base: 'text-2xl font-semibold',
    sm: 'text-xl font-semibold',
  },
  body: {
    // Body text
    lg: 'text-base leading-7',
    base: 'text-sm leading-6',
    sm: 'text-xs leading-5',
  },
  label: {
    // Form labels, small text
    base: 'text-sm font-semibold',
    sm: 'text-xs font-semibold',
  },
  mono: {
    // Technical, metadata, code
    base: 'font-mono text-sm',
    sm: 'font-mono text-xs',
  },
} as const;

/**
 * Spacing scale
 * Landing (generous) vs Dashboard (compact)
 */
export const SPACING = {
  landing: {
    sectionPy: 'py-24', // 96px top/bottom
    sectionGap: 'gap-8', // 32px between sections
    cardP: 'p-8', // 32px padding
  },
  flow: {
    sectionPy: 'py-8', // 32px top/bottom
    sectionGap: 'gap-4', // 16px between sections
    cardP: 'p-4', // 16px padding
  },
  dashboard: {
    sectionPy: 'py-8', // 32px top/bottom
    sectionGap: 'gap-3', // 12px between sections
    cardP: 'p-3', // 12px padding
  },
} as const;

/**
 * Border radius strategy
 * Landing: soft (friendly) | Dashboard: hard (technical)
 */
export const BORDER_RADIUS = {
  landing: {
    card: 'rounded-2xl', // 16px (friendly)
    button: 'rounded-2xl', // 16px (friendly)
    input: 'rounded-xl', // 12px
  },
  flow: {
    card: 'rounded-none', // 0px (sharp, technical)
    button: 'rounded-none', // 0px (sharp, technical)
    input: 'rounded-sm', // 4px
  },
  dashboard: {
    card: 'rounded-none', // 0px (hard-edge industrial)
    button: 'rounded-none', // 0px (hard-edge industrial)
    input: 'rounded-none', // 0px (hard-edge industrial)
  },
} as const;

/**
 * Shadow/Glass effects
 * Creates depth and hierarchy
 */
export const EFFECTS = {
  glass: 'backdrop-blur-md bg-white/5 border border-white/10',
  glassPetrol: 'backdrop-blur-md bg-petrol-600/5 border border-petrol-400/20',
  glassGold: 'backdrop-blur-md bg-gold-500/5 border border-gold-400/20',
  glassBlue: 'backdrop-blur-md bg-blue-600/5 border border-blue-400/20',
  elevatedDark: 'bg-obsidian-900 border border-titanium-900',
  elevatedLight: 'bg-white border border-slate-200',
} as const;

/**
 * Animation/transition values
 */
export const TRANSITIONS = {
  fast: 'transition-all duration-150',
  base: 'transition-all duration-200',
  slow: 'transition-all duration-300',
} as const;

/**
 * Combined theme by context
 * Use this to get all design values for a specific page context
 */
export const THEMES = {
  landing: {
    colors: CONTEXT_COLORS.landing,
    spacing: SPACING.landing,
    radius: BORDER_RADIUS.landing,
    bgClass: 'bg-white text-slate-900',
  },
  flow: {
    colors: CONTEXT_COLORS.flow,
    spacing: SPACING.flow,
    radius: BORDER_RADIUS.flow,
    bgClass: 'bg-obsidian-950 text-white',
  },
  dashboard: {
    colors: CONTEXT_COLORS.dashboard,
    spacing: SPACING.dashboard,
    radius: BORDER_RADIUS.dashboard,
    bgClass: 'bg-obsidian-950 text-titanium-100',
  },
} as const;

export type ContextType = keyof typeof THEMES;
export type ButtonVariant = keyof typeof BUTTON_HIERARCHY;
