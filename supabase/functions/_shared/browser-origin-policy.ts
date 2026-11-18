// Domain-Freigabe für die Browser-Runtime (PR B, Lücke G1).
//
// Quelle (AP-3-konform, ohne Migration): public.governance_policies
//   policy_type = 'data_transfer'      – eine Navigation übermittelt Daten an den Ziel-Origin
//   condition   = { "scope": "browser_origin", "origins": ["https://beispiel.de", …] }
//   action      = 'allow'  ⇒ Origins freigegeben
//                 'block'  ⇒ Origins gesperrt (schlägt 'allow')
//   mode        = 'enforce' zählt; 'observe' gewährt KEINE Freigabe (nur Beobachtung)
//   enabled     = true
//
// Grundsatz: Standard ist VERBOTEN. Ohne passende enforce-Freigabe darf der Agent
// keine Seite öffnen und auf keiner Seite handeln. Ist die Richtlinie nicht
// lesbar, wird nichts ausgeführt (fail-closed).
//
// Geprüft wird jede Aktion gegen den Origin, auf dem sie wirkt:
//   - navigate: Ziel-Origin der URL
//   - alle anderen: aktueller Seiten-Origin (page_origin bzw. Ziel des letzten navigate)
//   - verändernde Aktion: zusätzlich target.origin (Empfänger, aus PR A)
//
// Der Executor erhält allowed_origins und muss Navigationen, die die Seite
// selbst auslöst (Redirects, Links, Formularziele), ebenfalls blockieren.
// Für den Playwright-Dienst ist das nicht belegt.
//
// Keine Deno-Imports: vitest-importierbar.

export const ORIGIN_SCOPE = 'browser_origin';
export const POLICY_ENVIRONMENT = 'production';

export interface OriginPolicy {
  allow: Set<string>;
  block: Set<string>;
  policyIds: string[];
}

export type OriginCheck =
  | { ok: true; checked: string[] }
  | { ok: false; code: 'DOMAIN_NOT_ALLOWED'; origin: string; actionIndex: number | null; reason: string };

/** Reiner Origin oder null. Nur http/https, ohne Pfad/Query/Fragment/Zugangsdaten. */
export function bareOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.pathname !== '/' || u.search || u.hash || u.username || u.password || /[?#]/.test(value)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Origin einer beliebigen http(s)-URL oder null. */
export function originOfUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null;
  } catch {
    return null;
  }
}

interface PolicyRow { id?: string; action?: string; mode?: string | null; condition?: unknown }

/** Richtlinien-Zeilen → Freigabe/Sperre. Unbekannte oder fehlerhafte Einträge gewähren nichts. */
export function buildOriginPolicy(rows: PolicyRow[]): OriginPolicy {
  const allow = new Set<string>();
  const block = new Set<string>();
  const policyIds: string[] = [];
  for (const row of rows ?? []) {
    const c = row.condition && typeof row.condition === 'object' ? row.condition as Record<string, unknown> : null;
    if (!c || c.scope !== ORIGIN_SCOPE || !Array.isArray(c.origins)) continue;
    const origins = c.origins.map((o) => originOfUrl(o)).filter((o): o is string => !!o);
    if (row.action === 'block') {
      // Sperren gelten immer, auch im Beobachtungsmodus.
      origins.forEach((o) => block.add(o));
      if (row.id) policyIds.push(row.id);
    } else if (row.action === 'allow' && (row.mode ?? 'enforce') === 'enforce') {
      origins.forEach((o) => allow.add(o));
      if (row.id) policyIds.push(row.id);
    }
  }
  return { allow, block, policyIds };
}

function allowed(policy: OriginPolicy, origin: string): boolean {
  return policy.allow.has(origin) && !policy.block.has(origin);
}

/**
 * Prüft eine Aktionsfolge. pageOrigin = Seite vor der ersten Aktion (Pflicht,
 * wenn die erste Aktion kein navigate ist). targetOrigin = Empfänger einer
 * verändernden Aktion (PR A).
 */
export function checkActions(
  actions: Array<{ type: string; url?: string }>,
  pageOrigin: string | null,
  targetOrigin: string | null,
  policy: OriginPolicy,
): OriginCheck {
  let current = pageOrigin;
  const checked = new Set<string>();
  for (const [i, action] of actions.entries()) {
    const origin = action.type === 'navigate' ? originOfUrl(action.url) : current;
    if (!origin) {
      return { ok: false, code: 'DOMAIN_NOT_ALLOWED', origin: 'unbekannt', actionIndex: i, reason: 'origin of action unknown (page_origin missing)' };
    }
    if (!allowed(policy, origin)) {
      return { ok: false, code: 'DOMAIN_NOT_ALLOWED', origin, actionIndex: i, reason: policy.block.has(origin) ? 'origin is blocked by policy' : 'origin is not allowed for this tenant' };
    }
    checked.add(origin);
    current = origin;
  }
  if (targetOrigin) {
    if (!allowed(policy, targetOrigin)) {
      return { ok: false, code: 'DOMAIN_NOT_ALLOWED', origin: targetOrigin, actionIndex: null, reason: 'recipient (target.origin) is not allowed for this tenant' };
    }
    checked.add(targetOrigin);
  }
  return { ok: true, checked: [...checked] };
}

/** Lädt die Richtlinie des Mandanten. Wirft bei Fehler ⇒ Aufrufer blockiert (fail-closed). */
// deno-lint-ignore no-explicit-any
export async function loadOriginPolicy(admin: any, tenantId: string): Promise<OriginPolicy> {
  const { data, error } = await admin
    .from('governance_policies')
    .select('id, action, mode, condition')
    .eq('tenant_id', tenantId)
    .eq('enabled', true)
    .eq('policy_type', 'data_transfer')
    // N3: Nur Produktionsregeln zählen. Eine Freigabe für staging/development/testing
    // darf in der produktiven Runtime nichts erlauben (governance_policies.environment).
    .eq('environment', POLICY_ENVIRONMENT);
  if (error) throw new Error(`governance_policies: ${error.message}`);
  if (!Array.isArray(data)) throw new Error('governance_policies: no result');
  return buildOriginPolicy(data as PolicyRow[]);
}
