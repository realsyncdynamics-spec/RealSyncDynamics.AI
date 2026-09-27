/**
 * Sprachwahl der Governance-OS-Oberflächen (Handoff v2).
 *
 * DE ist Vorgabe. Die Wahl liegt in localStorage (`rsd-lang`) und gilt für
 * alle Komponenten gleichzeitig — ein kleiner externer Store statt Context,
 * damit Landing, Login, Preise und Audit ohne Provider in `App.tsx`
 * auskommen.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { translate, type HandoffKey, type Lang } from './handoff';

export const LANG_STORAGE_KEY = 'rsd-lang';

const listeners = new Set<() => void>();

function parseLang(value: string | null | undefined): Lang | null {
  return value === 'de' || value === 'en' ? value : null;
}

function readStoredLang(): Lang {
  try {
    return parseLang(window.localStorage.getItem(LANG_STORAGE_KEY)) ?? 'de';
  } catch {
    return 'de';
  }
}

let current: Lang | null = null;

function getSnapshot(): Lang {
  if (current === null) current = readStoredLang();
  return current;
}

function getServerSnapshot(): Lang {
  return 'de';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLang(next: Lang): void {
  current = next;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    /* nur für diese Sitzung */
  }
  try {
    document.documentElement.lang = next;
  } catch {
    /* SSR */
  }
  listeners.forEach((listener) => listener());
}

/** Nur für Tests: Store auf den gespeicherten Wert zurücksetzen. */
export function resetLangForTests(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

export function useLang(): {
  lang: Lang;
  setLang: (next: Lang) => void;
  toggleLang: () => void;
  t: (key: HandoffKey, vars?: Record<string, string | number>) => string;
} {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const t = useCallback(
    (key: HandoffKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
  const toggleLang = useCallback(() => setLang(lang === 'de' ? 'en' : 'de'), [lang]);
  return { lang, setLang, toggleLang, t };
}
