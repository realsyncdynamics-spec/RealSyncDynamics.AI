/**
 * App-Chrome für Governance-OS-Flächen (/app, /build) — Brand v4 (Dark/Gold/Cream).
 * Authoritative tokens: **this file** → CSS bridge in `governance-os-app.css`
 * (`.os-chrome.rs-app`) und die `--color-rs-*`-Tokens in `index.css`.
 * Preview surfaces (`/design/ledger`, `/design/tribunal`) keep local tokens —
 * do not import Cobalt/Burgundy into this module.
 *
 * ## Palettenwechsel Gold → Handoff v2 (bewusste Entscheidung)
 *
 * Bis Handoff v2 Phase 2 trug die App Gold (die frühere Gold-Palette). Der
 * Eigentümer hat für Phase 2 („App-Shell + Screens im Handoff-Design")
 * den Wechsel auf die Handoff-Palette angeordnet. Der Test
 * `test/app/app-theme.test.ts` hielt die Goldwerte ausdrücklich fest, damit
 * ein Farbwechsel „eine bewusste Entscheidung ist, kein Nebeneffekt" — das
 * ist er hiermit, und der Test friert jetzt die Handoff-Werte ein.
 *
 * Die Namen (`OS_GOLD`, `OS_CREAM`, …) bleiben als stabile API für die
 * bestehenden Importeure; ihre Bedeutung ist die Rolle, nicht der Farbton:
 *
 *   OS_GOLD       Akzent des Chrome           → Champagner #F2C98A
 *   OS_CREAM      Fläche primärer Buttons     → Champagner #F2C98A
 *   OS_CREAM_ALT  Hover/Verlauf               → Champagner hi #FBE7BD
 *   OS_CREAM_TEXT Schrift auf primären Buttons→ #050607
 *
 * ## Palettenwechsel Handoff v2 → Brand v4 (bewusste Entscheidung)
 *
 * Visual-Unification PR 2: Der Eigentümer hat die App auf die Landing-v4-
 * Palette (src/styles/brand-v4-tokens.css, `--brand-*`) zurückgeholt.
 * Cyan (#22C3E6, `--brand-live`) ist nur noch Live-Status, kein Chrome-Akzent.
 *
 * Die Kopplung an `landing-theme` bleibt gelöst: Diese Datei importiert
 * nichts von der Startseite.
 */

/** Akzent des App-Chrome (Rolle; Wert: v4-Champagner). */
export const OS_GOLD = '#F2C98A';
/** Grundflaeche. */
export const OS_BG = '#050607';
/** Flaeche primaerer Schaltflaechen (Rolle; Wert: v4-Champagner). */
export const OS_CREAM = '#F2C98A';
/** Hover-Variante primaerer Schaltflaechen. */
export const OS_CREAM_ALT = '#FBE7BD';
/** Schrift **auf** primaeren Schaltflaechen. */
export const OS_CREAM_TEXT = '#050607';
export const OS_H1 = 'clamp(2.5rem, 1.2rem + 4.2vw, 4.25rem)';
export const OS_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)';
export const OS_LINE = '#2B261D';
export const OS_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
export const OS_MUTED = '#A3ABB3';
export const OS_PANEL = '#0B0D0F';
export const OS_SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
export const OS_TEXT = '#F3F2F2';

/** Tailwind-friendly class fragments for chrome accents (Brand v4). */
export const OS_ACCENT_TEXT = 'text-[#F2C98A]';
export const OS_ACCENT_BORDER = 'border-[#F2C98A]';
export const OS_ACCENT_BG = 'bg-[#F2C98A]';
export const OS_CREAM_BTN =
  'bg-[#F2C98A] text-[#050607] hover:bg-[#FBE7BD] border border-[#F2C98A]';
export const OS_FOCUS_RING = 'focus-visible:ring-1 focus-visible:ring-[#FBE7BD]/60';
/** Input / control focus border — v4-Champagner. */
export const OS_FOCUS_BORDER = 'focus:border-[#F2C98A]';
/** Soft champagne wash for active stepper / selected chips. */
export const OS_ACCENT_SOFT = 'border-[#F2C98A] bg-[#F2C98A]/15 text-[#FBE7BD]';
