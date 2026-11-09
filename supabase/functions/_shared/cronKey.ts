// cronKey — liefert und prüft den Cron-Bearer-Key einer Function.
//
// Reihenfolge beim Auflösen:
//   1. Function Secret (Deno.env), wie bisher.
//   2. Fallback: derselbe Key direkt aus dem Vault über public.get_app_secret
//      (SECURITY DEFINER, EXECUTE nur für service_role). pg_cron schickt genau
//      diesen Vault-Eintrag via dispatch_cron_function — damit gibt es nur
//      noch eine Quelle der Wahrheit und kein manuelles Kopieren mehr.
//
// Fail-closed bleibt erhalten: Liefert keine der beiden Quellen einen Wert,
// kommt '' zurück und der Aufrufer antwortet weiter mit 500 CRON_KEY_MISSING.
// Der Key wird nie geloggt. Kurzer In-Memory-Cache (5 Min) pro Isolate, damit
// nicht jeder Aufruf einen Vault-Roundtrip kostet und Rotation trotzdem greift.
//
// Herkunft: Der Resolver lief seit 2026-11-01 (~04:30 UTC) per Live-Hotfix in
// scheduler-dispatch, memory-decay-worker und governance-monitoring-scheduler,
// stand aber nicht im Repo. Ohne diese Datei hätte der nächste CI-Deploy die
// Hotfixes zurückgesetzt.
//
// Keine Deno-Imports in dieser Datei (nur das Deno-Global zur Laufzeit), damit
// Tests sie mit gestubbtem `globalThis.Deno` importieren können.

import { jsonError, type CorsHeaders } from './gateway.ts';
import { timingSafeEqual } from './timingSafeEqual.ts';

const TTL_MS = 5 * 60_000;
const cache = new Map<string, { value: string; at: number }>();

export async function resolveCronKey(envName: string, vaultName: string): Promise<string> {
  const fromEnv = (Deno.env.get(envName) ?? '').trim();
  if (fromEnv) return fromEnv;

  const hit = cache.get(vaultName);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const url = Deno.env.get('SUPABASE_URL');
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !srk) return '';

  try {
    const res = await fetch(`${url}/rest/v1/rpc/get_app_secret`, {
      method: 'POST',
      headers: { apikey: srk, Authorization: `Bearer ${srk}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret_name: vaultName }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.error(JSON.stringify({ level: 'error', scope: 'cron_key_vault_lookup', vault: vaultName, status: res.status }));
      return '';
    }
    const v = await res.json();
    const key = typeof v === 'string' ? v.trim() : '';
    if (key) cache.set(vaultName, { value: key, at: Date.now() });
    return key;
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'cron_key_vault_lookup', vault: vaultName, error: String((e as Error)?.message ?? e) }));
    return '';
  }
}

/**
 * Gate für Maschinen-Endpunkte, die pg_cron über dispatch_cron_function
 * aufruft. Vertrag wie beim Cron-Trio und email-auth-rescan:
 *
 *   - kein Key auflösbar  → 500 CRON_KEY_MISSING (Fehlkonfiguration, kein Lauf)
 *   - falscher/fehlender Bearer → 401 "cron only"
 *   - passender Bearer    → null (Aufrufer fährt fort)
 *
 * Vergleich in konstanter Zeit. Der inbound Authorization-Header wird nie
 * gegen SUPABASE_SERVICE_ROLE_KEY verglichen: der service_role-JWT ist kein
 * Inbound-Credential (Entscheidung September 2026, Jobs 16–19).
 * Voraussetzung: verify_jwt = false in config.toml — ein Cron-Key ist kein JWT.
 */
export async function requireCronKey(
  req: Request,
  envName: string,
  vaultName: string,
  headers?: CorsHeaders,
): Promise<Response | null> {
  const key = await resolveCronKey(envName, vaultName);
  if (!key) {
    return jsonError(500, 'CRON_KEY_MISSING', `${envName} not configured`, headers);
  }
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!timingSafeEqual(authHeader, `Bearer ${key}`)) {
    return jsonError(401, 'UNAUTHORIZED', 'cron only', headers);
  }
  return null;
}

/** Nur für Tests: Cache zwischen Fällen leeren. */
export function __resetCronKeyCacheForTests(): void {
  cache.clear();
}
