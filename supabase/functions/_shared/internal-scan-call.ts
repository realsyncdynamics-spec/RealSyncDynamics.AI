// Interner Scan-Aufruf tenant-audit → gdpr-audit (Gate 2).
//
// gdpr-audit ist der öffentliche Lead-Magnet (verify_jwt=false). Sein
// Rate-Limit zählt pro ip_hash — beim Server-zu-Server-Aufruf aus
// tenant-audit ist das die Egress-IP der Edge-Runtime, also EIN Topf für
// alle Mandanten (5 Scans/Stunde plattformweit). Außerdem legte jeder
// Mandanten-Scan eine sales_leads-Zeile mit der E-Mail des Nutzers an —
// Lead-Tracking aus einer authentifizierten Governance-Aktion.
//
// Der interne Aufruf weist sich mit dem Service-Role-Key aus (liegt beiden
// Functions ohnehin als Env vor, verlässt den Server nie). Nur dann:
//   - kein IP-Rate-Limit (tenant-audit begrenzt pro Mandant, s. unten)
//   - keine sales_leads-Zeile, keine E-Mail in gdpr_audits
// Ein Body-Feld wie `source: 'tenant-audit'` allein reicht NICHT — das kann
// jeder öffentliche Aufrufer setzen.
//
// Deno-frei, damit Vitest es importieren kann.

export const INTERNAL_CALLER_HEADER = 'x-internal-caller';
export const TENANT_AUDIT_CALLER = 'tenant-audit';

/** Obergrenze für Website-Scans pro Mandant und Stunde (tenant-audit). */
export const TENANT_SCAN_LIMIT_PER_HOUR = 30;

async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Header für den Aufruf aus tenant-audit. */
export function internalScanHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    [INTERNAL_CALLER_HEADER]: TENANT_AUDIT_CALLER,
  };
}

/**
 * true nur, wenn der Aufrufer sich als tenant-audit ausweist UND den
 * Service-Role-Key als Bearer mitschickt. Fehlender Key in der Env ⇒ false.
 */
export async function isTrustedInternalScanCall(
  headers: Headers,
  serviceRoleKey: string | undefined | null,
): Promise<boolean> {
  if (!serviceRoleKey) return false;
  if (headers.get(INTERNAL_CALLER_HEADER) !== TENANT_AUDIT_CALLER) return false;
  const auth = headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  return await timingSafeEqualString(auth.slice(7), serviceRoleKey);
}
