/**
 * Die Startseite in zwei Farbmodi.
 *
 * ## Was umschaltbar ist — und was nicht
 *
 * Umgeschaltet wird die Tonung von Kopf und Bühne: Akzent, Grund, Linie,
 * Pill-Fläche, Tonung der Aufnahme. Layout, Typografie, Copy und jede Zahl
 * bleiben identisch. Es ist dieselbe Seite in zwei Farben, nicht zwei
 * Seiten — der Besucher soll eine Vorliebe ausdrücken können, nicht ein
 * anderes Produkt sehen.
 *
 * Die Abschnitte unterhalb des Hero folgen weiterhin `landing-theme.ts`
 * (Gold). Das ist bewusst: die Referenz zeigt beide Fassungen nur für den
 * ersten Bildschirm, und ein Umbau aller Flächen würde den Design-Freeze
 * (`CLAUDE.md`) ohne Not aufreissen.
 *
 * ## Warum Variablen und keine Hex-Werte
 *
 * `landing-theme.ts` bleibt unverändert die Quelle der Gold-Fassung und
 * wird von Flächen gelesen, die NICHT umschalten. Die Konstanten hier
 * zeigen stattdessen auf die CSS-Variablen aus `src/index.css`
 * (`[data-landing-mode]`), mit der Gold-Fassung als Rückfall — so bleibt
 * eine Fläche auch dann richtig getont, wenn das Attribut fehlt.
 */
import { useCallback, useEffect, useState } from 'react';

export type LandingMode = 'gold' | 'cyan';

export const LANDING_MODES: readonly LandingMode[] = ['gold', 'cyan'] as const;

export const LANDING_MODE_LABEL: Record<LandingMode, string> = {
  gold: 'Gold',
  cyan: 'Cyan',
};

const STORAGE_KEY = 'rsd-landing-mode';

/**
 * Gold ist die Vorgabe, nicht die Systemeinstellung.
 *
 * Beide Fassungen sind dunkel; `prefers-color-scheme` sagt hier nichts
 * Brauchbares aus. Ein neuer Besucher sieht deshalb immer Gold — das ist
 * das Markenbild. Erst eine bewusste Entscheidung am Schalter weicht davon
 * ab, und die gilt dann dauerhaft.
 */
const DEFAULT_MODE: LandingMode = 'gold';

function readStored(): LandingMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'cyan' || value === 'gold' ? value : DEFAULT_MODE;
  } catch {
    // Privates Fenster, gesperrte Site-Daten: dann eben ohne Gedächtnis.
    return DEFAULT_MODE;
  }
}

export function useLandingMode(): { mode: LandingMode; setMode: (next: LandingMode) => void } {
  // Serverseitig (Prerender) und im ersten Frame gilt die Vorgabe; die
  // gespeicherte Wahl wird erst nach dem Mount nachgezogen. Sonst laufen
  // Prerender-Markup und Client auseinander.
  const [mode, setModeState] = useState<LandingMode>(DEFAULT_MODE);

  useEffect(() => {
    const stored = readStored();
    if (stored !== DEFAULT_MODE) setModeState(stored);
  }, []);

  const setMode = useCallback((next: LandingMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Die Wahl gilt für diese Sitzung, wird aber nicht gemerkt. */
    }
  }, []);

  return { mode, setMode };
}

// ── Token: zeigen auf `[data-landing-mode]` in `src/index.css` ──────────

export const MODE_ACCENT = 'var(--rsd-accent, #d6ad68)';
export const MODE_ACCENT_SOFT = 'var(--rsd-accent-soft, #e8c98a)';
export const MODE_ACCENT_LITE = 'var(--rsd-accent-lite, #e4cfa2)';
export const MODE_BG = 'var(--rsd-bg, #0a0a0b)';
export const MODE_PANEL = 'var(--rsd-panel, #121214)';
export const MODE_BUTTON_INK = 'var(--rsd-btn-ink, #0a0a0b)';
export const MODE_LINE = 'var(--rsd-line, rgba(214, 173, 104, 0.22))';
export const MODE_GLOW = 'var(--rsd-glow, 0 0 32px rgba(214, 173, 104, 0.28))';
export const MODE_VEIL = 'var(--rsd-veil, #0a0a0b)';
export const MODE_SHOT_OPACITY = 'var(--rsd-shot-opacity, 0.55)';
export const MODE_SHOT_FILTER =
  'var(--rsd-shot-filter, sepia(0.5) saturate(1.5) hue-rotate(-14deg) contrast(1.08))';

/**
 * Akzent mit Deckung.
 *
 * Ersetzt die Schreibweise `` `${LANDING_ACCENT}47` ``, die einen festen
 * Hex-Wert voraussetzt und an einer CSS-Variablen still zu einer
 * ungültigen Farbe würde — also zu einem unsichtbaren Rahmen, ohne Fehler.
 *
 * @param percent Deckung in Prozent (0–100).
 */
export function modeAccent(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT} ${percent}%, transparent)`;
}

/** Dasselbe für den hellen Akzent. */
export function modeAccentSoft(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT_SOFT} ${percent}%, transparent)`;
}

/** Deckender Schleier über der Aufnahme — hält die linke Spalte lesbar. */
export function modeVeil(percent: number): string {
  return `color-mix(in srgb, ${MODE_VEIL} ${percent}%, transparent)`;
}
