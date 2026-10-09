// Zugangsregel für audit-report-email — bewusst ohne Deno-/jsr-Importe,
// damit Vitest sie direkt prüfen kann (test/edge/audit-report-email-gate.test.ts).
//
// Die Function läuft mit `verify_jwt = false`, weil ihr einziger realer
// Aufrufer der anonyme Browser direkt nach dem Free-Scan ist
// (AuditChatHero, AuditLanding). Wer die Audit-ID kennt, durfte bis hier
// jederzeit den Versand auslösen. Jetzt gilt:
//
//   - Service-Role-Bearer (Cron/Backoffice): immer erlaubt, ohne Zeitfenster.
//   - Ohne Bearer: nur solange die Zeile frisch ist. Der Browser feuert
//     Sekunden nach dem Insert in `gdpr-audit`; eine später abgegriffene ID
//     (geteilter Link, Verlauf, Referrer) läuft ins Leere.

/** Zeitfenster ab `created_at`, in dem der anonyme Browser-Aufruf gilt. */
export const FRESH_WINDOW_MS = 10 * 60 * 1000;

/** Toleranz für Uhrenversatz zwischen Postgres `now()` und Edge-Runtime. */
export const CLOCK_SKEW_MS = 60 * 1000;

export type SendDecision = 'service' | 'fresh' | 'denied';

export interface SendGateInput {
  authHeader: string | null;
  serviceKey: string | undefined;
  createdAt: string | null | undefined;
  now: number;
}

export function decideSend({ authHeader, serviceKey, createdAt, now }: SendGateInput): SendDecision {
  if (serviceKey && authHeader && safeEqual(authHeader, `Bearer ${serviceKey}`)) {
    return 'service';
  }
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isNaN(created)) return 'denied';
  const age = now - created;
  return age >= -CLOCK_SKEW_MS && age <= FRESH_WINDOW_MS ? 'fresh' : 'denied';
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
