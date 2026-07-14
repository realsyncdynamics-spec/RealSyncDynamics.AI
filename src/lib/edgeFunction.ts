import { getSupabaseUrl } from './supabaseUrl';

// POST-helper für Supabase Edge Functions
//
// Unterstützt sowohl auth-required (verify_jwt=true) als auch öffentliche (verify_jwt=false) Funktionen.
// Bei auth-required: JWT-Token wird aus localStorage geholt und als Bearer-Header gesendet.
// Basis-URL wird über `getSupabaseUrl()` aufgelöst (Fallback auf Produktions-URL falls VITE_SUPABASE_URL nicht gesetzt).
export async function postEdgeFunction<T>(
  fn: string,
  body: unknown,
  options?: { requireAuth?: boolean }
): Promise<T> {
  const SUPABASE_URL = getSupabaseUrl();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Auth-required Funktionen: JWT als Bearer Token mitschicken
  if (options?.requireAuth !== false) {
    const token = localStorage.getItem('sb-auth-token');
    if (!token) {
      throw new Error('Nicht authentifiziert – kein Token in localStorage');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

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
