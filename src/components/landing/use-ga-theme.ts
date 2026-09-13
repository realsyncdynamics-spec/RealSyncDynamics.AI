import { useCallback, useEffect, useState } from 'react';

/**
 * Variantenwahl der Startseite.
 *
 *   titan — gebürstetes Titan, Europa als Chromrelief, Champagner-Gold
 *   night — Schwarz, Europa als Nachtfoto, Cyan
 *
 * ## Titan ist die Vorgabe, nicht die Systemeinstellung
 *
 * Beide Varianten sind dunkel; `prefers-color-scheme` sagt hier also nichts
 * Brauchbares aus. Ein neuer Besucher sieht deshalb immer Titan — das ist das
 * Markenbild der Seite. Erst eine bewusste Entscheidung am Schalter weicht
 * davon ab, und die gilt dann dauerhaft.
 *
 * Die Wahl liegt in `localStorage`. Wo der Zugriff scheitert (privates
 * Fenster, gesperrte Site-Daten), bleibt es bei Titan, statt dass die Seite
 * stehenbleibt.
 */
export type GaTheme = 'titan' | 'night';

export const GA_THEMES: readonly GaTheme[] = ['titan', 'night'] as const;

export const GA_THEME_LABEL: Record<GaTheme, string> = {
  titan: 'Titan',
  night: 'Nacht',
};

const STORAGE_KEY = 'rsd-landing-theme';
const DEFAULT_THEME: GaTheme = 'titan';

function readStored(): GaTheme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'night' || value === 'titan' ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function useGaTheme(): { theme: GaTheme; setTheme: (next: GaTheme) => void } {
  // Serverseitig (Prerender) und beim ersten Frame gilt die Vorgabe; die
  // gespeicherte Wahl wird erst nach dem Mount nachgezogen. Sonst läuft der
  // Prerender-Markup gegen den Client auseinander.
  const [theme, setThemeState] = useState<GaTheme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = readStored();
    if (stored !== DEFAULT_THEME) setThemeState(stored);
  }, []);

  const setTheme = useCallback((next: GaTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Die Wahl gilt für diese Sitzung, wird aber nicht gemerkt. */
    }
  }, []);

  return { theme, setTheme };
}
