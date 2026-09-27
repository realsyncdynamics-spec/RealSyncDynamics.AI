/**
 * App-Chrome für Governance-OS-Flächen (/app, /build) — Handoff v2 (Cyan).
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
 *   OS_GOLD       Akzent des Chrome           → Cyan  #00B8D4
 *   OS_CREAM      Fläche primärer Buttons     → Primary #1E5AFF
 *   OS_CREAM_ALT  Hover/Verlauf               → Primary hover #1641C4
 *   OS_CREAM_TEXT Schrift auf primären Buttons→ #FFFFFF
 *
 * Die Kopplung an `landing-theme` bleibt gelöst: Diese Datei importiert
 * nichts von der Startseite.
 */

/** Akzent des App-Chrome (Rolle; Wert: Handoff-Cyan). */
export const OS_GOLD = '#00B8D4';
/** Grundflaeche. */
export const OS_BG = '#070B14';
/** Flaeche primaerer Schaltflaechen (Rolle; Wert: Handoff-Primary). */
export const OS_CREAM = '#1E5AFF';
/** Hover-Variante primaerer Schaltflaechen. */
export const OS_CREAM_ALT = '#1641C4';
/** Schrift **auf** primaeren Schaltflaechen. */
export const OS_CREAM_TEXT = '#FFFFFF';
export const OS_H1 = 'clamp(2.5rem, 1.2rem + 4.2vw, 4.25rem)';
export const OS_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)';
export const OS_LINE = '#1F2B48';
export const OS_MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";
export const OS_MUTED = '#8A95AC';
export const OS_PANEL = '#0D1322';
export const OS_SERIF = "'Newsreader', Georgia, 'Times New Roman', serif";
export const OS_TEXT = '#F2F5FA';

/** Tailwind-friendly class fragments for chrome accents (Handoff v2). */
export const OS_ACCENT_TEXT = 'text-[#00B8D4]';
export const OS_ACCENT_BORDER = 'border-[#00B8D4]';
export const OS_ACCENT_BG = 'bg-[#00B8D4]';
export const OS_CREAM_BTN =
  'bg-[#1E5AFF] text-white hover:bg-[#1641C4] border border-[#1E5AFF]';
export const OS_FOCUS_RING = 'focus-visible:ring-1 focus-visible:ring-[#4FD4E8]/60';
/** Input / control focus border — Handoff-Cyan. */
export const OS_FOCUS_BORDER = 'focus:border-[#00B8D4]';
/** Soft cyan wash for active stepper / selected chips. */
export const OS_ACCENT_SOFT = 'border-[#00B8D4] bg-[#00B8D4]/15 text-[#4FD4E8]';
