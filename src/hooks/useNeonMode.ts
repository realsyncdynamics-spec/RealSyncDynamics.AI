import { useCallback, useEffect, useState } from 'react';

/**
 * Hell/Dunkel-Modus des Neon-Designs (Startseite und App-Shell).
 * Die Wahl gilt nur für diesen Browser (localStorage) und ist reine
 * Darstellung — kein Zustand, auf den sich irgendetwas verlassen darf.
 * Ohne Speicher (privater Modus, gesperrt) gilt der übergebene Standard.
 */
export type NeonMode = 'light' | 'dark';

function readMode(key: string, fallback: NeonMode): NeonMode {
  try {
    const v = window.localStorage.getItem(key);
    return v === 'light' || v === 'dark' ? v : fallback;
  } catch {
    return fallback;
  }
}

export function useNeonMode(key: string, fallback: NeonMode): [NeonMode, () => void] {
  const [mode, setMode] = useState<NeonMode>(() => (typeof window === 'undefined' ? fallback : readMode(key, fallback)));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, mode);
    } catch {
      /* Speicher nicht verfügbar: Wahl gilt nur für diese Sitzung. */
    }
  }, [key, mode]);

  const toggle = useCallback(() => setMode((m) => (m === 'light' ? 'dark' : 'light')), []);
  return [mode, toggle];
}
