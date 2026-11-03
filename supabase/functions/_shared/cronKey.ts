// checkCronKey — Inbound-Prüfung für Maschinen-Endpunkte (pg_cron, DB-Trigger).
//
// Deno-frei wie timingSafeEqual.ts, damit Tests genau diesen Code prüfen.
// `requireCronKey` in auth.ts liest das Function Secret und baut daraus die
// Response; die Entscheidung selbst fällt hier.
//
// Vertrag (docs/runbooks/cron-vault-secrets.md):
//   leerer Key        → 500 CRON_KEY_MISSING (Fehlkonfiguration, keine Arbeit)
//   falscher Bearer   → 401 "cron only"
//   Vergleich         → konstantzeitig, nie gegen SUPABASE_SERVICE_ROLE_KEY

import { timingSafeEqual } from './timingSafeEqual.ts';

export type CronKeyResult =
  | { ok: true }
  | { ok: false; status: 500; code: 'CRON_KEY_MISSING'; message: string }
  | { ok: false; status: 401; code: 'UNAUTHORIZED'; message: 'cron only' };

export function checkCronKey(
  cronKey: string | undefined | null,
  authHeader: string | null | undefined,
  envName: string,
): CronKeyResult {
  const CRON_KEY = (cronKey ?? '').trim();
  if (!CRON_KEY) {
    return { ok: false, status: 500, code: 'CRON_KEY_MISSING', message: `${envName} not configured` };
  }
  const header = authHeader ?? '';
  if (!header.startsWith('Bearer ') || !timingSafeEqual(header, `Bearer ${CRON_KEY}`)) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'cron only' };
  }
  return { ok: true };
}
