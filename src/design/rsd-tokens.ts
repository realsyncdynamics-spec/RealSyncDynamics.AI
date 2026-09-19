/**
 * Design-Tokens des RealSync-Dynamics-AI-Prototyps.
 *
 * Quelle: `design/handoff/realsync-ai-app/README.md`, Abschnitt „Design
 * Tokens". Die Werte dort sind als hifi gekennzeichnet — final, nicht
 * Richtwerte. Deshalb stehen sie hier als Konstanten und nicht als
 * Tailwind-Klassen verstreut ueber zehn Screens: aendert der Entwurf einen
 * Farbwert, ist es eine Zeile und keine Suche.
 *
 * Abgrenzung zum Bestand: `governance-ai-theme.ts` (Titan, Gold) beschreibt
 * die heutige Landing. Dieser Satz ist der Cyan-Entwurf und gilt zunaechst
 * nur fuer die Flaechen, die er bereits bedient. Beide gleichzeitig im Repo
 * zu haben ist Absicht und kein Versehen — welcher Satz wo gilt, entscheidet
 * der Eigentuemer, nicht dieser Modul.
 */

import type { EnforcementClass } from '../../shared/enforcement-classes';

/** Flaechen, von aussen nach innen. */
export const RSD_BG = {
  /** Nur der Hero der Landing — dunkler als die App. */
  hero: '#02050B',
  base: '#070B14',
  raised: '#0D1322',
  hover: '#14203A',
  active: '#1D2B48',
} as const;

/** Text, von kraeftig nach leise. */
export const RSD_FG = {
  strong: '#F2F5FA',
  base: '#C9D1E0',
  muted: '#8A95AC',
  faint: '#5A6684',
} as const;

export const RSD_BORDER = {
  base: '#1F2B48',
  strong: '#2E3C5E',
} as const;

/** Primaerfarbe: Aktion. */
export const RSD_PRIMARY = {
  base: '#1E5AFF',
  hover: '#1641C4',
  light: '#7FA0FF',
} as const;

/** Akzent: Herkunft, Hashes, Governance-Begriffe. */
export const RSD_ACCENT = {
  base: '#00B8D4',
  light: '#4FD4E8',
} as const;

/** Zustandsfarben. `danger` ist auch die Farbe der Klasse D. */
export const RSD_STATE = {
  success: '#10B981',
  warning: '#F5A524',
  danger: '#E5484D',
  violet: '#7C5CFF',
} as const;

/**
 * Durchsetzbarkeits-Klassen A–D.
 *
 * Die Klasse selbst wird abgeleitet, nie eingegeben — die Wahrheit dazu
 * steht in `shared/enforcement-classes.ts`. Hier steht ausschliesslich,
 * welche Farbe sie traegt.
 */
export const RSD_CLASS_COLOR: Readonly<Record<EnforcementClass, string>> = {
  A: RSD_STATE.success,
  B: RSD_ACCENT.base,
  C: RSD_STATE.warning,
  D: RSD_STATE.danger,
} as const;

/**
 * Schriften. Newsreader ausschliesslich fuer die Hero-H1 — eine Serife in
 * einer sonst serifenlosen Oberflaeche traegt genau dann, wenn sie einmal
 * vorkommt.
 */
export const RSD_FONT = {
  ui: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  display: "'Inter Tight', 'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
  heroSerif: "'Newsreader', Georgia, 'Times New Roman', serif",
} as const;

export const RSD_FONT_FEATURES = '"ss01", "cv11"' as const;

/** Radien nach Verwendung, nicht nach Groesse benannt. */
export const RSD_RADIUS = {
  input: 4,
  navChip: 6,
  button: 8,
  card: 8,
  priceCard: 16,
  pill: 9999,
} as const;

/** Abstandsleiter. Nur diese Werte, keine Zwischenschritte. */
export const RSD_SPACE = [4, 8, 12, 16, 20, 24, 32, 48, 56, 64] as const;

/**
 * Bewegung: eine Kurve, zwei Dauern.
 *
 * Kein Bounce, kein Hover-Scale — der Entwurf schreibt das ausdruecklich
 * fest. `seal` gilt nur fuer die Verifikation der Hash-Kette, wo die
 * Dauer die Arbeit sichtbar macht.
 */
export const RSD_MOTION = {
  easing: 'cubic-bezier(.2,.8,.2,1)',
  durationMs: 200,
  sealMs: 600,
} as const;

/** Deckkraft fuer Bedienelemente, die es gibt, aber gerade nicht gehen. */
export const RSD_DISABLED_OPACITY = 0.45 as const;

/**
 * Die Klassen kommen aus der SSoT, nicht von hier. Kaeme eine Klasse E
 * hinzu, faellt dieses Modul beim Typcheck auf, weil `RSD_CLASS_COLOR`
 * dann eine Farbe schuldet.
 */
export type RsdEnforcementClass = EnforcementClass;
