// Domain-Freigaben für die Browser-Runtime verwalten (Folge-PR zu PR B).
//
// op: 'set_browser_origins'  { tenant_id, list: 'allow' | 'block', origins: string[] }
//
// Ersetzt die Liste der vom Dashboard verwalteten Freigaben bzw. Sperren eines
// Mandanten. Gespeichert wird im Format, das browser-execute liest
// (_shared/browser-origin-policy.ts), ohne Migration:
//   policy_type = 'data_transfer', environment = 'production', mode = 'enforce',
//   condition = { scope: 'browser_origin', origins: [...], managed_by: 'browser_origins_ui' }
//
// Pro Mandant und Liste gibt es genau eine verwaltete Zeile. Regeln, die auf
// anderem Weg angelegt wurden (create_policy, Policy Packs), bleiben unberührt
// und gelten weiter.
//
// Regeln:
//   - Nur owner/admin (Rolle aus memberships, Mandant aus dem Body wird gegen
//     die Mitgliedschaft geprüft, nie vertraut).
//   - Nur https-Origins ohne Pfad, Query, Fragment, Zugangsdaten oder Platzhalter.
//     Eine ungültige Angabe lehnt die ganze Änderung ab (kein Teil-Speichern).
//   - Leere Liste ist erlaubt: Die Zeile bleibt bestehen und gewährt nichts.
//   - Kein Entitlement-Gate (policy.packs): Ohne Freigabe ist die Runtime nach
//     PR B gesperrt; ein Tarif-Gate würde Mandanten dauerhaft aussperren.
//
// Keine Deno-Imports: vitest-importierbar. Abhängigkeiten werden übergeben.

export const MANAGED_BY = 'browser_origins_ui';
export const ORIGIN_SCOPE = 'browser_origin';
export const MAX_ORIGINS = 100;

export type OriginList = 'allow' | 'block';

export type NormalizedOrigin =
  | { ok: true; origin: string }
  | { ok: false; input: string; reason: string };

/** Nutzereingabe → https-Origin. „beispiel.de“ wird zu „https://beispiel.de“. */
export function normalizeOriginInput(raw: unknown): NormalizedOrigin {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (!input) return { ok: false, input: String(raw ?? ''), reason: 'leer' };
  if (input.length > 300) return { ok: false, input: input.slice(0, 60), reason: 'zu lang' };
  if (input.includes('*')) return { ok: false, input, reason: 'Platzhalter (*) sind nicht erlaubt' };
  if (/\s/.test(input)) return { ok: false, input, reason: 'enthält Leerzeichen' };

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(input);
  const candidate = hasScheme ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, input, reason: 'keine gültige Adresse' };
  }
  if (url.protocol !== 'https:') return { ok: false, input, reason: 'nur https ist erlaubt' };
  if (url.username || url.password) return { ok: false, input, reason: 'Zugangsdaten in der Adresse sind nicht erlaubt' };
  if (url.search || url.hash || /[?#]/.test(input)) return { ok: false, input, reason: 'nur die Domain angeben, ohne ? oder #' };
  if (url.pathname !== '/' ) return { ok: false, input, reason: 'nur die Domain angeben, ohne Pfad' };
  const host = url.hostname;
  if (!host || (!host.includes('.') && host !== 'localhost')) return { ok: false, input, reason: 'keine vollständige Domain' };
  if (host === 'localhost') return { ok: false, input, reason: 'localhost ist nicht erlaubt' };
  return { ok: true, origin: url.origin };
}

export type OriginListResult =
  | { ok: true; origins: string[] }
  | { ok: false; errors: Array<{ input: string; reason: string }> };

/** Validiert eine ganze Liste. Dedupliziert und sortiert. Ein Fehler lehnt alles ab. */
export function validateOriginList(raw: unknown, max = MAX_ORIGINS): OriginListResult {
  if (!Array.isArray(raw)) return { ok: false, errors: [{ input: '', reason: 'origins muss eine Liste sein' }] };
  const out = new Set<string>();
  const errors: Array<{ input: string; reason: string }> = [];
  for (const entry of raw) {
    const n = normalizeOriginInput(entry);
    if (n.ok) out.add(n.origin);
    else errors.push({ input: n.input, reason: n.reason });
  }
  if (errors.length) return { ok: false, errors };
  if (out.size > max) return { ok: false, errors: [{ input: '', reason: `höchstens ${max} Domains je Liste` }] };
  return { ok: true, origins: [...out].sort() };
}

export interface SetOriginsDeps {
  isOwnerOrAdmin(userId: string, tenantId: string): Promise<boolean>;
  audit(entry: {
    tenant_id: string;
    actor_user_id: string;
    actor_email: string | null;
    action: string;
    target_type: string;
    target_id: string;
    payload: Record<string, unknown>;
  }): Promise<unknown>;
}

export type HandlerResult =
  | { status: 200; body: { ok: true; list: OriginList; origins: string[]; policy_id: string; added: string[]; removed: string[] } }
  | { status: 400 | 403 | 500; code: string; message: string; details?: unknown };

function err(status: 400 | 403 | 500, code: string, message: string, details?: unknown): HandlerResult {
  return { status, code, message, details };
}

const LIST_NAMES: Record<OriginList, string> = {
  allow: 'Browser-Runtime: freigegebene Domains',
  block: 'Browser-Runtime: gesperrte Domains',
};

/**
 * Setzt die verwaltete Freigabe- oder Sperrliste. `admin` ist ein
 * Service-Role-Client (nur serverseitig).
 */
// deno-lint-ignore no-explicit-any
export async function setBrowserOrigins(admin: any, userId: string, userEmail: string | null, b: Record<string, unknown>, deps: SetOriginsDeps): Promise<HandlerResult> {
  const tenantId = typeof b.tenant_id === 'string' ? b.tenant_id.trim() : '';
  const list = b.list;
  if (!tenantId) return err(400, 'BAD_REQUEST', 'tenant_id required');
  if (list !== 'allow' && list !== 'block') return err(400, 'BAD_REQUEST', "list must be 'allow' or 'block'");

  // Rolle vor jeder Inhaltsprüfung: Unbefugte erfahren nichts über die Validierung.
  if (!(await deps.isOwnerOrAdmin(userId, tenantId))) return err(403, 'FORBIDDEN', 'must be owner or admin');

  const validated = validateOriginList(b.origins);
  if (!validated.ok) return err(400, 'INVALID_ORIGINS', 'Mindestens eine Domain ist ungültig. Es wurde nichts gespeichert.', validated.errors);
  const origins = validated.origins;

  const { data: rows, error: readErr } = await admin
    .from('governance_policies')
    .select('id, condition, created_at')
    .eq('tenant_id', tenantId)
    .eq('policy_type', 'data_transfer')
    .eq('environment', 'production')
    .eq('action', list)
    .order('created_at', { ascending: true });
  if (readErr) return err(500, 'INTERNAL', `governance_policies: ${readErr.message ?? 'read failed'}`);

  const managed = ((rows ?? []) as Array<{ id: string; condition: unknown }>).filter((r) => {
    const c = r.condition && typeof r.condition === 'object' ? r.condition as Record<string, unknown> : null;
    return c?.scope === ORIGIN_SCOPE && c?.managed_by === MANAGED_BY;
  });
  const existing = managed[0] ?? null;
  const before = existing && Array.isArray((existing.condition as Record<string, unknown>).origins)
    ? ((existing.condition as Record<string, unknown>).origins as unknown[]).filter((o): o is string => typeof o === 'string')
    : [];

  const condition = { scope: ORIGIN_SCOPE, origins, managed_by: MANAGED_BY };
  let policyId: string;
  if (existing) {
    const { error } = await admin
      .from('governance_policies')
      .update({ condition, enabled: true, mode: 'enforce' })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId);
    if (error) return err(500, 'INTERNAL', `governance_policies: ${error.message ?? 'update failed'}`);
    policyId = existing.id;
  } else {
    const { data, error } = await admin
      .from('governance_policies')
      .insert({
        tenant_id: tenantId,
        name: LIST_NAMES[list],
        description: 'Verwaltet im Dashboard (Browser-Runtime → Domain-Freigaben).',
        policy_type: 'data_transfer',
        severity: 'high',
        action: list,
        condition,
        enabled: true,
        mode: 'enforce',
        environment: 'production',
      })
      .select('id')
      .single();
    if (error || !data?.id) return err(500, 'INTERNAL', `governance_policies: ${error?.message ?? 'insert failed'}`);
    policyId = data.id as string;
  }

  // Doppelte verwaltete Zeilen (z. B. zwei gleichzeitige Erst-Speicherungen)
  // würden entfernte Domains weiter freigeben, weil browser-execute alle Zeilen
  // vereinigt. Sie werden deaktiviert; maßgeblich ist nur die erste.
  for (const dup of managed.slice(1)) {
    const { error } = await admin
      .from('governance_policies')
      .update({ enabled: false })
      .eq('id', dup.id)
      .eq('tenant_id', tenantId);
    if (error) return err(500, 'INTERNAL', `governance_policies: ${error.message ?? 'update failed'}`);
  }

  const added = origins.filter((o) => !before.includes(o));
  const removed = before.filter((o) => !origins.includes(o));
  await deps.audit({
    tenant_id: tenantId,
    actor_user_id: userId,
    actor_email: userEmail,
    action: list === 'allow' ? 'policy.browser_origins.allow.set' : 'policy.browser_origins.block.set',
    target_type: 'governance_policy',
    target_id: policyId,
    payload: { list, count: origins.length, added, removed },
  });

  return { status: 200, body: { ok: true, list, origins, policy_id: policyId, added, removed } };
}
