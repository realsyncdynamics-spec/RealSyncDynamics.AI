/**
 * Token architecture — four layers, one direction.
 *
 *   1. Primitive   landing-theme.ts     hex / font stacks / type scale
 *   2. Semantic    this file            role names (void, ink, signal)
 *   3. Mode        landing-mode.ts      CSS var with primitive fallback
 *   4. Bind        landing-tokens.css   --rsd-* on :root / .landing-context
 *
 * Components consume layer 3 (`MODE_*` / `RSD_TOKEN`). Never skip to hex
 * in JSX. Pricing numbers stay in shared/pricing.ts — not here.
 */
import {
  LANDING_ACCENT,
  LANDING_ACCENT_LITE,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BODY,
  LANDING_BUTTON_TEXT,
  LANDING_GREEN,
  LANDING_H1,
  LANDING_H2,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_PANEL,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from './landing-theme';

export const PRIMITIVE = {
  color: {
    void: LANDING_BG,
    panel: LANDING_PANEL,
    ink: LANDING_TEXT,
    muted: LANDING_MUTED,
    signal: LANDING_ACCENT,
    signalSoft: LANDING_ACCENT_SOFT,
    signalLite: LANDING_ACCENT_LITE,
    onSignal: LANDING_BUTTON_TEXT,
    live: LANDING_GREEN,
    line: LANDING_LINE,
  },
  font: {
    sans: LANDING_SANS,
    serif: LANDING_SERIF,
    mono: LANDING_MONO,
  },
  type: {
    display: LANDING_H1,
    title: LANDING_H2,
    body: LANDING_BODY,
  },
} as const;

/** Role → primitive. Change roles here, hex only in landing-theme.ts. */
export const SEMANTIC = {
  surface: {
    canvas: PRIMITIVE.color.void,
    raised: PRIMITIVE.color.panel,
  },
  content: {
    primary: PRIMITIVE.color.ink,
    secondary: PRIMITIVE.color.muted,
  },
  action: {
    fill: PRIMITIVE.color.signal,
    onFill: PRIMITIVE.color.onSignal,
    ring: PRIMITIVE.color.signal,
  },
  status: {
    live: PRIMITIVE.color.live,
    hairline: PRIMITIVE.color.line,
  },
  type: {
    headline: PRIMITIVE.font.serif,
    body: PRIMITIVE.font.sans,
    meta: PRIMITIVE.font.mono,
  },
} as const;

export const CSS_VAR = {
  surface: { canvas: '--rsd-bg', raised: '--rsd-panel' },
  content: { primary: '--rsd-text', secondary: '--rsd-muted' },
  action: { fill: '--rsd-accent', onFill: '--rsd-btn-ink', ring: '--rsd-accent' },
  status: { live: '--rsd-live', hairline: '--rsd-line' },
} as const;

export function cssVar(name: string, fallback?: string): string {
  return fallback ? `var(${name}, ${fallback})` : `var(${name})`;
}
