/**
 * Named CSS tokens for the Titan landing.
 * Values: `src/styles/landing-tokens.css` + `landing-theme.ts`.
 */
export const RSD_TOKEN = {
  bg: 'var(--rsd-bg)',
  panel: 'var(--rsd-panel)',
  text: 'var(--rsd-text)',
  muted: 'var(--rsd-muted)',
  accent: 'var(--rsd-accent)',
  accentSoft: 'var(--rsd-accent-soft)',
  accentLite: 'var(--rsd-accent-lite)',
  btnInk: 'var(--rsd-btn-ink)',
  line: 'var(--rsd-line)',
  glow: 'var(--rsd-glow)',
  veil: 'var(--rsd-veil)',
  live: 'var(--rsd-live)',
  fontSans: 'var(--rsd-font-sans)',
  fontSerif: 'var(--rsd-font-serif)',
  fontMono: 'var(--rsd-font-mono)',
  h1: 'var(--rsd-h1)',
  h2: 'var(--rsd-h2)',
  body: 'var(--rsd-body)',
  eyebrow: 'var(--rsd-eyebrow)',
} as const;

export type RsdTokenName = keyof typeof RSD_TOKEN;
