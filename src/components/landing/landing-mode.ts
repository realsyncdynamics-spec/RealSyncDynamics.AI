/**
 * Die Startseite in drei Farbmodi.
 *
 * ## Was umschaltbar ist — und was nicht
 *
 * Umgeschaltet wird die Tonung von Kopf und Bühne: Akzent, Grund, Linie,
 * Pill-Fläche, Tonung der Aufnahme. Layout, Typografie, Copy und jede Zahl
 * bleiben identisch. Es ist dieselbe Seite in drei Farben, nicht drei
 * Seiten — der Besucher soll eine Vorliebe ausdrücken können, nicht ein
 * anderes Produkt sehen.
 *
 * Alle Hauptflächen von `MainLanding` lesen für die Umschaltung diese
 * Variablen. Fallback-Routen und Bereiche ohne `data-landing-mode` bleiben
 * weiter auf der Gold-Basis von `landing-theme.ts`.
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

export type LandingMode = 'gold' | 'cyan' | 'light';

export const LANDING_MODES: readonly LandingMode[] = ['gold', 'cyan', 'light'] as const;

export const LANDING_MODE_LABEL: Record<LandingMode, string> = {
  gold: 'Dunkel',
  cyan: 'Cyan',
  light: 'Hell',
};

const STORAGE_KEY = 'rsd-landing-mode';

const DEFAULT_MODE: LandingMode = 'gold';

function readStored(): LandingMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'cyan' || value === 'gold' || value === 'light' ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function useLandingMode(): { mode: LandingMode; setMode: (next: LandingMode) => void } {
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

export const MODE_ACCENT = 'var(--rsd-accent, #d6ad68)';
export const MODE_ACCENT_SOFT = 'var(--rsd-accent-soft, #e8c98a)';
export const MODE_ACCENT_LITE = 'var(--rsd-accent-lite, #e4cfa2)';
export const MODE_BG = 'var(--rsd-bg, #0a0a0b)';
export const MODE_PANEL = 'var(--rsd-panel, #121214)';
export const MODE_BUTTON_INK = 'var(--rsd-btn-ink, #0a0a0b)';
export const MODE_TEXT = 'var(--rsd-text, #f2eee6)';
export const MODE_MUTED = 'var(--rsd-muted, #9a9aa1)';
export const MODE_LINE = 'var(--rsd-line, rgba(214, 173, 104, 0.22))';
export const MODE_HEADER_BORDER = 'var(--rsd-header-border, rgba(255, 255, 255, 0.06))';
export const MODE_HEADER_BG = 'var(--rsd-header-bg, rgba(10, 10, 11, 0.82))';
export const MODE_HEADER_BG_OVERLAY = 'var(--rsd-header-bg-overlay, rgba(10, 10, 11, 0.35))';
export const MODE_GLOW = 'var(--rsd-glow, 0 0 32px rgba(214, 173, 104, 0.28))';
export const MODE_VEIL = 'var(--rsd-veil, #0a0a0b)';
export const MODE_SHOT_OPACITY = 'var(--rsd-shot-opacity, 0.55)';
export const MODE_SHOT_FILTER =
  'var(--rsd-shot-filter, sepia(0.5) saturate(1.5) hue-rotate(-14deg) contrast(1.08))';

/** Metall-Pill — Token, kein Hex in den Komponenten. */
export const MODE_PILL_FACE =
  'linear-gradient(180deg, var(--rsd-accent-soft, #e8c98a) 0%, var(--rsd-accent, #d6ad68) 100%)';

export function modeAccent(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT} ${percent}%, transparent)`;
}

export function modeAccentSoft(percent: number): string {
  return `color-mix(in srgb, ${MODE_ACCENT_SOFT} ${percent}%, transparent)`;
}

export function modeVeil(percent: number): string {
  return `color-mix(in srgb, ${MODE_VEIL} ${percent}%, transparent)`;
}
