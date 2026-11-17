/**
 * Internes Ziel nach dem Login (`?next=`), getrennt von der Auth-Callback-URL.
 *
 * Hintergrund: Supabase akzeptiert nur Callback-URLs aus der Allowlist. Hängt
 * die Login-Seite die komplette Query (`?next=…`, `?utm_source=…`) an den
 * Rücksprung, passt die URL nicht mehr zum exakt freigegebenen `/welcome` und
 * Supabase fällt auf die Site URL zurück. Deshalb geht der Rücksprung immer auf
 * das nackte `/welcome`; das gewünschte Ziel wird hier zwischengespeichert.
 *
 * - `localStorage` statt `sessionStorage`: Magic Links öffnen oft einen neuen Tab.
 * - Nur Pfade, die `safeInternalPath` besteht (kein offener Redirect).
 * - Zeitlich begrenzt; es werden keine Tokens oder Sitzungsdaten gespeichert.
 * - Jeder Zugriff ist abgesichert: Speicher kann fehlen oder werfen.
 */
import { safeInternalPath } from './safeInternalPath';

export const AUTH_RESUME_KEY = 'rs:auth-resume-next';
export const AUTH_RESUME_TTL_MS = 30 * 60 * 1000;

interface StoredTarget {
  path: string;
  exp: number;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Speichert ein gültiges internes Ziel; ungültige oder leere Werte löschen einen alten Eintrag. */
export function storeAuthResumeTarget(raw: string | null | undefined, now = Date.now()): string | null {
  const store = storage();
  const path = safeInternalPath(raw);
  if (!store) return path;
  try {
    if (!path) {
      store.removeItem(AUTH_RESUME_KEY);
      return null;
    }
    const value: StoredTarget = { path, exp: now + AUTH_RESUME_TTL_MS };
    store.setItem(AUTH_RESUME_KEY, JSON.stringify(value));
  } catch {
    // Speicher voll oder gesperrt: Login funktioniert trotzdem, nur ohne Fortsetzung.
  }
  return path;
}

/** Liest das Ziel und löscht den Eintrag in jedem Fall (einmalig verwendbar). */
export function consumeAuthResumeTarget(now = Date.now()): string | null {
  const store = storage();
  if (!store) return null;
  let raw: string | null = null;
  try {
    raw = store.getItem(AUTH_RESUME_KEY);
    store.removeItem(AUTH_RESUME_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredTarget>;
    if (typeof parsed.exp !== 'number' || parsed.exp < now) return null;
    return safeInternalPath(typeof parsed.path === 'string' ? parsed.path : null);
  } catch {
    return null;
  }
}

/** Exakte Callback-URL ohne Query — muss mit der Supabase-Allowlist übereinstimmen. */
export function authCallbackUrl(origin: string = window.location.origin): string {
  return `${origin.replace(/\/$/, '')}/welcome`;
}
