/**
 * Shared Dark / Gold / Cream chrome for Governance OS surfaces (/app, /build).
 * Authoritative tokens: `landing-theme.ts` → `OS_*` here → CSS bridge in
 * `index.css` (`.os-chrome` / `.dashboard-context`). No cyan/purple product chrome.
 * Preview surfaces (`/design/ledger`, `/design/tribunal`) keep local tokens —
 * do not import Cobalt/Burgundy into this module.
 */
export {
  LANDING_ACCENT as OS_GOLD,
  LANDING_BG as OS_BG,
  LANDING_BUTTON as OS_CREAM,
  LANDING_BUTTON_ALT as OS_CREAM_ALT,
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

/** Tailwind-friendly class fragments for chrome accents (hard-edge, Cream/Gold only). */
export const OS_ACCENT_TEXT = 'text-[#e4cfa2]';
export const OS_ACCENT_BORDER = 'border-[#e4cfa2]';
export const OS_ACCENT_BG = 'bg-[#e4cfa2]';
export const OS_CREAM_BTN =
  'bg-[#e8ddc8] text-[#1a1917] hover:bg-[#f0e6d4] border border-[#e8ddc8]';
export const OS_FOCUS_RING = 'focus-visible:ring-1 focus-visible:ring-[#e4cfa2]/50';
/** Input / control focus border — cream-gold, never ai-cyan / #00E5FF. */
export const OS_FOCUS_BORDER = 'focus:border-[#e4cfa2]';
/** Soft gold wash for active stepper / selected chips. */
export const OS_ACCENT_SOFT = 'border-[#e4cfa2] bg-[#e4cfa2]/15 text-[#e4cfa2]';
