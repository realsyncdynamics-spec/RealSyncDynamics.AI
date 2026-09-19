/**
 * Shared Dark / Gold / Cream chrome for Governance OS surfaces (/app, /build).
 * Authoritative tokens: **this file** → CSS bridge in `index.css`
 * (`.os-chrome` / `.dashboard-context`). No cyan/purple product chrome.
 * Preview surfaces (`/design/ledger`, `/design/tribunal`) keep local tokens —
 * do not import Cobalt/Burgundy into this module.
 *
 * ## Warum die Werte hier stehen und nicht aus `landing-theme` kommen
 *
 * Bis zur Entkopplung re-exportierte diese Datei dreizehn `LANDING_*` als
 * `OS_*`. Damit haette jede Aenderung an der Marketing-Palette die App
 * mitgezogen — und zwar nur zur Haelfte: Die Tailwind-Fragmente weiter unten
 * sind hartkodiert und waeren stehengeblieben. Ein Farbwechsel auf `/` haette
 * also nicht die App umgefaerbt, sondern zwei Akzente nebeneinander erzeugt.
 *
 * Die Werte unten sind die aufgeloesten Werte von vor der Entkopplung, Wert
 * fuer Wert uebernommen. Das ist Absicht: Der Schnitt soll nichts an der
 * Darstellung aendern, sondern nur die Kopplung aufloesen. Wer die App
 * umfaerben will, aendert ab jetzt diese Datei; wer die Startseite umfaerbt,
 * laesst sie in Ruhe.
 *
 * ## Zwei Dinge, die beim Entkoppeln sichtbar wurden
 *
 * - `OS_GOLD` und `OS_CREAM` tragen denselben Wert. Die Namen versprechen
 *   eine Unterscheidung, die es nicht gibt — vor einer Vereinheitlichung
 *   gehoert geklaert, welcher der beiden gemeint war.
 * - Die Tailwind-Fragmente nutzen `#e4cfa2`, die Konstanten hier `#d6ad68`.
 *   Die App traegt also zwei Goldtoene. Das war schon vorher so; es hier
 *   anzugleichen waere eine sichtbare Aenderung, kein Aufraeumen.
 */

/** Akzent des App-Chrome. */
export const OS_GOLD = '#d6ad68';
/** Grundflaeche. */
export const OS_BG = '#0a0a0b';
/** Flaeche heller Schaltflaechen. Wertgleich mit `OS_GOLD` — s. o. */
export const OS_CREAM = '#d6ad68';
/** Hellere Variante fuer Verlaeufe und Hover. */
export const OS_CREAM_ALT = '#e8c98a';
/** Schrift **auf** hellen Schaltflaechen — dunkel, trotz des Namens. */
export const OS_CREAM_TEXT = '#0a0a0b';
export const OS_H1 = 'clamp(2.5rem, 1.2rem + 4.2vw, 4.25rem)';
export const OS_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)';
export const OS_LINE = 'rgba(214, 173, 104, 0.22)';
export const OS_MONO = "'DM Mono', 'JetBrains Mono', ui-monospace, monospace";
export const OS_MUTED = '#9a9aa1';
export const OS_PANEL = '#121214';
export const OS_SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
export const OS_TEXT = '#f2eee6';

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
