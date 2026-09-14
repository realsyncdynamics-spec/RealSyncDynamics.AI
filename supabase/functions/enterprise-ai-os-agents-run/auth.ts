// Zugriffsprüfung für den Agent-Runner.
//
// ## Warum es diese Datei gibt
//
// `enterprise-ai-os-agents-run` lief mit `verify_jwt = false` und ohne jede
// Eingangsprüfung. Die `tenantId` kam aus dem Request-Body und floss in einen
// Service-Role-Client, der RLS umgeht. Wer eine Tenant-UUID kannte, konnte
// ohne Anmeldung
//
//   - fremde `ai_systems` lesen (die Agenten geben sie als `findings` zurück),
//   - fremde `enterprise_agent_runs` erzeugen,
//   - fremde Usage auf `limit.agent_runs_monthly` buchen, die
//     `stripe-meter-sync` anschliessend als Overage abrechnet.
//
// Die Prüfung liegt bewusst in einer eigenen Datei ohne `jsr:`-Importe: so
// ist sie aus Vitest importierbar und ihr Verhalten testbar, statt nur den
// Quelltext auf Stichworte abzuklopfen. Das Muster folgt `_shared/findings.ts`
// und `_shared/scan-pipeline.ts`, die aus demselben Grund strukturelle Typen
// statt eines echten Supabase-Clients nehmen.
//
// Reihenfolge der Prüfungen ist Absicht: Erst wer der Aufrufer IST, dann
// worauf er zugreifen darf. Ein Fehler in Schritt 1 darf nie zu einer
// Datenbankabfrage in Schritt 2 führen.

/** Ein Tenant wird nur als UUID akzeptiert — auch damit nichts Freies in eine Query wandert. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthDeps {
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

export type AccessResult =
  | { ok: true; userId: string; tenantId: string }
  | { ok: false; status: 400 | 401 | 403 | 500; code: string; message: string };

export interface AccessRequest {
  /** Roher `Authorization`-Header, so wie er hereinkam. */
  authHeader: string | null;
  /** `tenantId` aus dem Request-Body. Wird geprüft, nicht geglaubt. */
  bodyTenantId: unknown;
}

/**
 * Ermittelt, für welchen Tenant dieser Aufruf ausgeführt werden darf.
 *
 * Der Rückgabewert ist die einzige Quelle für die `tenant_id`, die danach in
 * Reads, Inserts und Usage geht. Der Wert aus dem Body wird nach dieser
 * Funktion nicht mehr angefasst.
 */
export async function resolveTenantAccess(
  req: AccessRequest,
  deps: AuthDeps,
): Promise<AccessResult> {
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
  // Vorher lief die Function bei fehlender tenantId weiter und fragte
  // `.eq('tenant_id', null)` ab — ohne Persistenz, ohne Usage, mit einem
  // Ergebnis, das nichts bedeutet. Das ist kein sinnvoller Betriebsmodus,
  // sondern ein stiller Leerlauf. Er wird jetzt abgelehnt.
  const tenantId = typeof req.bodyTenantId === 'string' ? req.bodyTenantId.trim() : '';
  if (!tenantId) {
    return { ok: false, status: 400, code: 'TENANT_REQUIRED', message: 'tenantId is required' };
  }
  if (!UUID_RE.test(tenantId)) {
    return { ok: false, status: 400, code: 'INVALID_TENANT', message: 'tenantId must be a valid UUID' };
  }

  // 3. Darf dieser User für diesen Tenant? Erst hier fällt die Entscheidung.
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
