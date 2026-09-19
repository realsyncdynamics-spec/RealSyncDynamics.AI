/**
 * Sprachumschalter fuer die Produktoberflaeche.
 *
 * Deutsch ist Standard und bleibt es auch ohne gespeicherte Wahl — die
 * Zielgruppe ist deutschsprachig, Englisch ist das Zugestaendnis, nicht
 * umgekehrt. Die Wahl liegt in `localStorage`, damit sie einen Reload
 * ueberlebt; schlaegt der Zugriff fehl (privates Fenster, blockierte
 * Site-Daten), bleibt es bei Deutsch statt bei einer Ausnahme.
 *
 * `<html lang>` wird mitgefuehrt: Screenreader und Uebersetzungsdienste
 * lesen das Attribut, nicht unseren Zustand.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  isLocale,
  translate,
  type Locale,
  type StringKey,
} from './strings';

const STORAGE_KEY = 'rsd.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  /** Text in der aktiven Sprache. */
  t: (key: StringKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function gespeicherteSprache(): Locale {
  try {
    const roh = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(roh) ? roh : DEFAULT_LOCALE;
  } catch {
    // Privates Fenster oder blockierte Site-Daten — kein Grund zu scheitern.
    return DEFAULT_LOCALE;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(gespeicherteSprache);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Die Sprache gilt fuer diese Sitzung, sie ueberlebt nur den Reload nicht.
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key: StringKey) => translate(locale, key),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Sprache und Texte.
 *
 * Ohne Provider gilt Deutsch. Das ist Absicht: eine Oberflaeche, die
 * ausserhalb des Providers gerendert wird — ein Test, eine isolierte
 * Vorschau — soll Text zeigen und nicht abstuerzen.
 */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key: StringKey) => translate(DEFAULT_LOCALE, key),
  };
}
