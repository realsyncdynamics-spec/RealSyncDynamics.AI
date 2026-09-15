/**
 * Shared Dark / Gold / Cream chrome for Governance OS surfaces (/app, /build).
 * Same palette as the public landing — no cyan night-map accents in product chrome.
 */
export {
  LANDING_ACCENT as OS_GOLD,
  LANDING_BG as OS_BG,
  LANDING_BUTTON as OS_CREAM,
  LANDING_BUTTON_TEXT as OS_CREAM_TEXT,
  LANDING_H1 as OS_H1,
  LANDING_H2 as OS_H2,
  LANDING_LINE as OS_LINE,
  LANDING_MONO as OS_MONO,
  LANDING_MUTED as OS_MUTED,
  LANDING_PANEL as OS_PANEL,
  LANDING_SERIF as OS_SERIF,
  LANDING_TEXT as OS_TEXT,
} from '../landing/landing-theme';

/** Tailwind-friendly class fragments for chrome accents (hard-edge, no cyan). */
export const OS_ACCENT_TEXT = 'text-[#e4cfa2]';
export const OS_ACCENT_BORDER = 'border-[#e4cfa2]';
export const OS_ACCENT_BG = 'bg-[#e4cfa2]';
export const OS_CREAM_BTN =
  'bg-[#e8ddc8] text-[#1a1917] hover:bg-[#f0e6d4] border border-[#e8ddc8]';
export const OS_FOCUS_RING = 'focus-visible:ring-1 focus-visible:ring-[#e4cfa2]/50';
