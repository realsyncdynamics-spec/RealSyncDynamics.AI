// Zugriffspruefung fuer Edge Functions: wer ruft, und fuer welchen Tenant.
//
// ## Warum es diese Datei gibt
//
// Dieselbe Pruefung stand bisher in jeder Function neu — tenant-audit,
// ai-invoke, automation-trigger schreiben sie je einmal aus, und
// enterprise-ai-os-agents-run hatte sie gar nicht. Das ist die Form, in der
// so eine Pruefung irgendwo fehlt, ohne dass es auffaellt.
//
// Die Datei kommt bewusst ohne `jsr:`-Importe aus: so ist sie aus Vitest
// importierbar und ihr Verhalten testbar, statt nur ihr Quelltext auf
// Stichworte abklopfbar. Muster wie `_shared/findings.ts` und
// `_shared/scan-pipeline.ts`, die aus demselben Grund strukturelle Typen
// statt eines echten Supabase-Clients nehmen.
//
// Reihenfolge ist Absicht: Erst wer der Aufrufer IST, dann worauf er
// zugreifen darf. Ein Fehler in Schritt 1 darf nie zu einer Datenbank-
// abfrage in Schritt 2 fuehren.
//
// Verwandt: functions/enterprise-ai-os-agents-run/auth.ts enthaelt heute
// dieselbe Logik als eigene Kopie (PR #1383). Sie wird auf dieses Modul
// umgestellt, sobald beide PRs gemergt sind — das ist der Schritt
// "gemeinsame Enforcement-Schicht".

/** Ein Tenant wird nur als UUID akzeptiert — auch damit nichts Freies in eine Query wandert. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantAccessDeps {
  /**
   * Verifiziert das Bearer-Token und liefert die User-Id, sonst `null`.
   * Wirft die Implementierung, gilt das als nicht authentifiziert (401) —
   * ein kaputter Token darf nicht als Serverfehler durchgehen.
   */
  getUserId(jwt: string): Promise<string | null>;
  /**
   * `true`, wenn der User Mitglied des Tenants ist. Wirft bei
   * Infrastrukturfehlern — die werden zu 500, nicht zu 403, damit ein
   * DB-Ausfall nicht wie eine Zugriffsverweigerung aussieht.
   */
  isMember(userId: string, tenantId: string): Promise<boolean>;
}

export type TenantAccess =
  | { ok: true; userId: string; tenantId: string }
  | { ok: false; status: 400 | 401 | 403 | 500; code: string; message: string };

export interface TenantAccessRequest {
  /** Roher `Authorization`-Header, so wie er hereinkam. */
  authHeader: string | null;
  /** Genannter Tenant — aus Header oder Body. Wird geprueft, nicht geglaubt. */
  tenantId: unknown;
}

/**
 * Ermittelt, fuer welchen Tenant dieser Aufruf ausgefuehrt werden darf.
 *
 * Der Rueckgabewert ist die einzige Quelle fuer die `tenant_id`, die danach
 * in Reads, Inserts und Usage geht. Der vom Aufrufer genannte Wert wird nach
 * dieser Funktion nicht mehr angefasst.
 */
export async function resolveTenantAccess(
  req: TenantAccessRequest,
  deps: TenantAccessDeps,
): Promise<TenantAccess> {
  // 1. Wer ruft? Ohne Bearer gar nicht erst weiter.
  const header = req.authHeader ?? '';
  if (!header.startsWith('Bearer ')) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'Bearer token required' };
  }
  const jwt = header.slice(7).trim();
  if (!jwt) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'empty Bearer token' };
  }

  let userId: string | null;
  try {
    userId = await deps.getUserId(jwt);
  } catch {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'invalid jwt' };
  }
  if (!userId) {
    return { ok: false, status: 401, code: 'UNAUTHORIZED', message: 'invalid jwt' };
  }

  // 2. Welcher Tenant? Fehlender Tenant ist kein "dann eben ohne".
  //
  // Ein Aufruf ohne Tenant liesse sich weder einem Kontingent zuordnen noch
  // abrechnen — er liefe still auf Kosten des Betreibers. Genau das soll
  // hier nicht mehr moeglich sein.
  const tenantId = typeof req.tenantId === 'string' ? req.tenantId.trim() : '';
  if (!tenantId) {
    return { ok: false, status: 400, code: 'TENANT_REQUIRED', message: 'tenant id is required' };
  }
  if (!UUID_RE.test(tenantId)) {
    return { ok: false, status: 400, code: 'INVALID_TENANT', message: 'tenant id must be a valid UUID' };
  }

  // 3. Darf dieser User fuer diesen Tenant? Erst hier faellt die Entscheidung.
  let member: boolean;
  try {
    member = await deps.isMember(userId, tenantId);
  } catch (e) {
    return {
      ok: false,
      status: 500,
      code: 'INTERNAL',
      message: e instanceof Error ? e.message : 'membership lookup failed',
    };
  }
  if (!member) {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'not a member of this tenant' };
  }

  return { ok: true, userId, tenantId };
}

/**
 * Reicht das Kontingent fuer einen weiteren Verbrauch?
 *
 * Bewusst getrennt vom Buchen: geprueft wird VOR dem Provider-Aufruf,
 * gebucht wird DANACH. `consumeUsage` aus `_shared/usage.ts` macht beides in
 * einem Schritt — das wuerde hier einen Aufruf verbuchen, der am Provider
 * noch scheitern kann.
 *
 * `-1` heisst unbegrenzt, ein fehlender Eintrag heisst "kein Kontingent
 * hinterlegt" und wird durchgelassen. Dieselbe Auslegung wie in
 * automation-trigger.
 */
export function quotaWouldExceed(args: {
  current: number;
  limit: number | undefined;
  delta?: number;
}): boolean {
  const { current, limit, delta = 1 } = args;
  if (typeof limit !== 'number') return false;
  if (limit === -1) return false;
  return current + delta > limit;
}
