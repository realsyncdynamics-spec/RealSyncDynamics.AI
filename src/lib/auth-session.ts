/**
 * Client-side auth token hygiene.
 *
 * Refresh-Token-Rotation (GoTrue) schützt vor Wiederverwendung nach Diebstahl.
 * Diese Datei schließt die Lücke davor: Access/Refresh dürfen nicht in der
 * Adresszeile, History oder in Fehlerberichten liegen bleiben.
 *
 * Nicht enthalten (eigenes Auth-Modell, Edge-Cookie): HttpOnly-Refresh.
 * localStorage bleibt der Supabase-SPA-Store; die Preview darf ihn nicht
 * sehen (kein allow-same-origin).
 */

export const AUTH_URL_SECRET_PARAMS = [
  'code',
  'access_token',
  'refresh_token',
  'token_type',
  'expires_in',
  'expires_at',
  'provider_token',
  'provider_refresh_token',
] as const;

const SECRET = new Set<string>(AUTH_URL_SECRET_PARAMS);

export const SPA_AUTH_OPTIONS = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  flowType: 'pkce' as const,
};

function filterSecretPairs(raw: string, prefix: '?' | '#'): { value: string; changed: boolean } {
  const body = raw.startsWith(prefix) ? raw.slice(1) : raw;
  if (!body) return { value: '', changed: false };
  const parts = body.split('&').filter(Boolean);
  const kept = parts.filter((part) => {
    const key = decodeURIComponent((part.split('=')[0] ?? '').replace(/\+/g, ' '));
    return !SECRET.has(key);
  });
  return { value: kept.join('&'), changed: kept.length !== parts.length };
}

/** Entfernt Auth-Secrets aus Query und Hash. Idempotent, ohne History-Eintrag. */
export function stripSensitiveAuthFromLocation(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
  replace: (url: string) => void = (url) => {
    if (typeof window !== 'undefined') window.history.replaceState({}, '', url);
  },
): string | null {
  const q = filterSecretPairs(loc.search, '?');
  const h = filterSecretPairs(loc.hash, '#');
  if (!q.changed && !h.changed) return null;

  const next = `${loc.pathname}${q.value ? `?${q.value}` : ''}${h.value ? `#${h.value}` : ''}`;
  replace(next);
  return next;
}

/** URLs in Logs/Sentry: Secret-Werte ersetzen, Keys sichtbar lassen. */
export function redactAuthInUrl(raw: string): string {
  try {
    const u = new URL(raw, 'https://realsyncdynamicsai.de');
    for (const key of AUTH_URL_SECRET_PARAMS) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '[redacted]');
    }
    if (u.hash) {
      const hash = new URLSearchParams(u.hash.replace(/^(#)/, ''));
      let changed = false;
      for (const key of AUTH_URL_SECRET_PARAMS) {
        if (hash.has(key)) {
          hash.set(key, '[redacted]');
          changed = true;
        }
      }
      if (changed) u.hash = hash.toString();
    }
    return u.toString();
  } catch {
    return raw;
  }
}
