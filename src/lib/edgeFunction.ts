import { edgeFunctionUrl, fnFetchInit } from './fn-proxy';
import { getSupabase } from './supabase';

/** Thrown when requireAuth is on (default) and there is no valid Supabase session. */
export const EDGE_AUTH_REQUIRED_MESSAGE =
  'Nicht authentifiziert – keine gültige Sitzung' as const;

export function isEdgeAuthRequiredError(message: string | null | undefined): boolean {
  if (!message) return false;
  return (
    message === EDGE_AUTH_REQUIRED_MESSAGE ||
    /nicht authentifiziert|kein Token in localStorage|keine gültige Sitzung/i.test(message)
  );
}

/**
 * Access-Token der aktuellen Supabase-Sitzung (supabase-js frischt es bei
 * Bedarf auf). Vorher las der Helper `localStorage['sb-auth-token']` — einen
 * Schlüssel, den nichts schreibt (supabase-js speichert unter
 * `sb-<projekt>-auth-token`, als JSON). Jeder auth-pflichtige Aufruf
 * scheiterte deshalb auch angemeldet mit „Nicht authentifiziert“.
 */
async function sessionAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// POST-helper für Supabase Edge Functions (Production: same-origin CSRF-Proxy).
//
// Unterstützt sowohl auth-required (verify_jwt=true) als auch öffentliche (verify_jwt=false) Funktionen.
// Bei auth-required: das Access-Token der Supabase-Sitzung wird als Bearer-Header gesendet.
// Öffentliche Free-Flows (gdpr-audit, cookie-scan, …) MÜSSEN `{ requireAuth: false }` setzen.
export async function postEdgeFunction<T>(
  fn: string,
  body: unknown,
  options?: { requireAuth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Auth-required Funktionen: JWT der Sitzung als Bearer Token mitschicken
  if (options?.requireAuth !== false) {
    const token = await sessionAccessToken();
    if (!token) {
      throw new Error(EDGE_AUTH_REQUIRED_MESSAGE);
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = edgeFunctionUrl(fn);
  let resp: Response;
  try {
    resp = await fetch(url, fnFetchInit(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }));
  } catch {
    throw new Error(
      `Backend nicht erreichbar (${fn}). Bitte Netzwerkverbindung prüfen und erneut versuchen.`,
    );
  }

  const text = await resp.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch {
      throw new Error(`Ungültige Server-Antwort (HTTP ${resp.status}).`);
    }
  }

  const payload = (data ?? {}) as { ok?: boolean; error?: { message?: string } };
  if (!resp.ok || !payload.ok) {
    throw new Error(payload.error?.message ?? `HTTP ${resp.status}`);
  }
  return data as T;
}
