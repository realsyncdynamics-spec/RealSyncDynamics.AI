/**
 * PDP v2 — Deno-Glue: Snapshot-Laden, Instanz-Cache, Persistenz, Shadow-Log.
 *
 * Trennung: `core.ts` ist rein und in Vitest getestet; diese Datei enthaelt
 * alles mit IO (Supabase-Client). PEPs in Edge Functions rufen `decide()`
 * in-process auf — kein HTTP-Hop zum PDP noetig; der HTTP-Endpunkt
 * `governance-decide` existiert fuer externe PEPs (SDK-Preflight).
 *
 * Latenz-Modell (Plan §2.6): pro Instanz und Tenant wird der kompilierte
 * Snapshot fuer PDP_CACHE_TTL_MS gehalten. Nur bei Cache-Miss werden die
 * Policy-Tabellen gelesen; jede Entscheidung selbst ist eine reine Funktion.
 *
 * Sicherheitsrelevanz: Laedt mit service_role — deshalb liegt diese Datei
 * ausschliesslich unter supabase/functions/ (CLAUDE.md §4). tenant_id kommt
 * IMMER vom authentifizierten Kontext des Aufrufers, nie aus dem Request-Body.
 */

// deno-lint-ignore-file no-explicit-any
import {
  approvalFingerprint,
  buildSnapshot,
  evaluateSnapshot,
  orgAncestors,
  type DecisionRequest,
  type DecisionResult,
  type PolicySnapshot,
} from './core.ts';

export const PDP_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  snapshot: PolicySnapshot;
  expiresAt: number;
  /** Version, die bereits nach policy_snapshots persistiert wurde. */
  persistedVersion: string | null;
}

// Pro-Instanz-Cache; Kaltstart leert ihn — akzeptiert, weil der erste
// Request danach ohnehin die Policies laden muss.
const SNAPSHOT_CACHE = new Map<string, CacheEntry>();

function cacheKey(tenantId: string | null): string {
  return tenantId ?? '__global__';
}

/**
 * Laedt und kompiliert den Policy-Snapshot eines Tenants.
 *
 * Scoping folgt exakt den Alt-Pfaden (bewusst NICHT vereinheitlicht):
 *   - ai_policies:         tenant ODER global   (wie telemetry-ai-event)
 *   - governance_policies: nur tenant           (wie governance-ingest)
 * tenant_id=null (z. B. ai-gateway ohne Tenant-Kontext) laedt nur globale
 * ai_policies — governance_policies sind per Definition tenant-gebunden.
 */
export async function loadSnapshot(
  admin: any,
  tenantId: string | null,
): Promise<PolicySnapshot> {
  const key = cacheKey(tenantId);
  const now = Date.now();
  const hit = SNAPSHOT_CACHE.get(key);
  if (hit && hit.expiresAt > now) return hit.snapshot;

  let aiQuery = admin
    .from('ai_policies')
    .select('id, name, rule_type, action, enabled, condition')
    .eq('enabled', true);
  aiQuery = tenantId
    ? aiQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    : aiQuery.is('tenant_id', null);
  const { data: aiRows, error: aiErr } = await aiQuery;
  if (aiErr) throw new Error(`ai_policies: ${aiErr.message}`);

  let govRows: any[] = [];
  if (tenantId) {
    const { data, error } = await admin
      .from('governance_policies')
      .select('id, policy_type, action, enabled, condition')
      .eq('tenant_id', tenantId)
      .eq('enabled', true);
    if (error) throw new Error(`governance_policies: ${error.message}`);
    govRows = data ?? [];
  }

  const snapshot = buildSnapshot(tenantId, aiRows ?? [], govRows);
  SNAPSHOT_CACHE.set(key, {
    snapshot,
    expiresAt: now + PDP_CACHE_TTL_MS,
    persistedVersion: hit?.persistedVersion ?? null,
  });
  return snapshot;
}

/**
 * Persistiert den Snapshot nach policy_snapshots (einmal pro Version und
 * Instanz; UNIQUE(tenant_id, version) dedupliziert instanzuebergreifend).
 * Best-effort: Ein Persistenz-Fehler darf keine Entscheidung verhindern.
 */
export async function persistSnapshot(admin: any, snapshot: PolicySnapshot): Promise<void> {
  if (!snapshot.tenant_id) return; // globale Snapshots haben keinen Tenant-Traeger
  const key = cacheKey(snapshot.tenant_id);
  const entry = SNAPSHOT_CACHE.get(key);
  if (entry?.persistedVersion === snapshot.version) return;
  try {
    const { error } = await admin.from('policy_snapshots').upsert(
      {
        tenant_id: snapshot.tenant_id,
        version: snapshot.version,
        source_counts: {
          ai_policies: snapshot.policies.filter((p) => p.source === 'ai_policies').length,
          governance_policies: snapshot.policies.filter((p) => p.source === 'governance_policies').length,
        },
        compiled: snapshot.policies,
      },
      { onConflict: 'tenant_id,version', ignoreDuplicates: true },
    );
    if (!error && entry) entry.persistedVersion = snapshot.version;
  } catch (e) {
    console.error('[pdp] snapshot persist failed', e);
  }
}

/**
 * PIP-Anreicherung (P1-1): Haengt am Request ein Principal mit id, wird er
 * gegen principals / role_bindings / org_units aufgeloest — Rollen entlang
 * des Org-Pfads (eine Bindung an einer Einheit gilt fuer deren Teilbaum).
 * Best-effort: schlaegt die Aufloesung fehl, entscheidet der PDP mit dem,
 * was der Aufrufer mitgegeben hat — nie mit MEHR Rechten als angegeben.
 */
export async function enrichPrincipal(
  admin: any,
  request: DecisionRequest,
): Promise<DecisionRequest> {
  const pid = request.principal?.id;
  if (!pid || !request.tenant_id) return request;
  try {
    let { data: p } = await admin
      .from('principals')
      .select('id, type, org_unit_id, status')
      .eq('tenant_id', request.tenant_id)
      .eq('id', pid)
      .maybeSingle();
    if (!p && request.principal?.type === 'user') {
      const r = await admin
        .from('principals')
        .select('id, type, org_unit_id, status')
        .eq('tenant_id', request.tenant_id)
        .eq('user_id', pid)
        .maybeSingle();
      p = r.data;
    }
    if (!p) return request;

    let orgPath: string | undefined;
    if (p.org_unit_id) {
      const { data: unit } = await admin
        .from('org_units')
        .select('org_path')
        .eq('id', p.org_unit_id)
        .maybeSingle();
      orgPath = unit?.org_path ?? undefined;
    }

    // Deaktivierte Principals behalten KEINE Rollen — sie werden nicht
    // unsichtbar (Policies auf principal_type greifen weiter), aber jede
    // rollenbasierte Erlaubnis erlischt.
    let roles: string[] = [];
    if (p.status === 'active') {
      const { data: bindings } = await admin
        .from('role_bindings')
        .select('role, scope_type, org_unit_id')
        .eq('tenant_id', request.tenant_id)
        .eq('principal_id', p.id);
      const ancestors = new Set(orgAncestors(orgPath));
      roles = [...new Set((bindings ?? [])
        .filter((b: { scope_type: string; org_unit_id: string | null }) =>
          b.scope_type === 'tenant' || (b.org_unit_id !== null && ancestors.has(b.org_unit_id)))
        .map((b: { role: string }) => b.role))];
    }

    return {
      ...request,
      principal: {
        ...request.principal!,
        id: p.id,
        type: p.type,
        org_unit: p.org_unit_id ?? request.principal?.org_unit,
        org_path: orgPath,
        roles,
      },
    };
  } catch (e) {
    console.error('[pdp] principal enrichment failed', e);
    return request;
  }
}

/**
 * Freigabe-Kette (P1-4): require_approval wird gegen pdp_approval_gates
 * aufgeloest. Eine erteilte, nicht abgelaufene Freigabe mit identischem
 * Request-Fingerprint deckt die Aktion (→ allow mit Begruendung); sonst
 * wird genau EIN offenes Gate je Fingerprint gefuehrt.
 * Fehlerverhalten: bei jedem Fehler bleibt es bei require_approval —
 * die Kette darf nie versehentlich freigeben.
 */
async function resolveApproval(
  admin: any,
  request: DecisionRequest,
  result: DecisionResult,
  snapshot: PolicySnapshot,
): Promise<DecisionResult> {
  if (result.decision !== 'require_approval' || !request.tenant_id) return result;
  const approverRole =
    snapshot.policies.find((p) => p.id === result.primary_policy_id)?.approver_role ?? 'approver';
  try {
    const fp = approvalFingerprint(request);
    const nowIso = new Date().toISOString();

    const { data: approved } = await admin
      .from('pdp_approval_gates')
      .select('id, expires_at')
      .eq('tenant_id', request.tenant_id)
      .eq('fingerprint', fp)
      .eq('status', 'approved')
      .gt('expires_at', nowIso)
      .order('resolved_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (approved) {
      return {
        ...result,
        decision: 'allow',
        reasons: [
          {
            policy_id: result.primary_policy_id ?? '',
            policy_source: result.reasons[0]?.policy_source ?? 'governance_policies',
            rule: 'approval_coverage',
            action: 'allow',
            text_de: `Die Aktion ist durch eine erteilte Freigabe gedeckt (Gate ${approved.id}).`,
          },
          ...result.reasons,
        ],
        approval: { gate_id: approved.id, approver_role: approverRole, status: 'approved' },
        ttl_ms: 0,
      };
    }

    const { data: pending } = await admin
      .from('pdp_approval_gates')
      .select('id')
      .eq('tenant_id', request.tenant_id)
      .eq('fingerprint', fp)
      .eq('status', 'pending')
      .maybeSingle();
    let gateId: string | null = pending?.id ?? null;
    if (!gateId) {
      const { data: created, error } = await admin
        .from('pdp_approval_gates')
        .insert({
          tenant_id: request.tenant_id,
          fingerprint: fp,
          policy_id: result.primary_policy_id,
          approver_role: approverRole,
          requested_by: request.principal?.id ?? null,
          // Datenminimierung: nur die identitaetsstiftenden Felder, keine Inhalte
          request_summary: {
            channel: request.action.channel,
            verb: request.action.verb,
            vendor: request.target?.vendor ?? null,
            model: request.target?.model ?? null,
            classification: request.data?.classification ?? null,
          },
        })
        .select('id')
        .maybeSingle();
      if (error) {
        // Unique-Konflikt = paralleles Gate — nachlesen statt scheitern
        const { data: raced } = await admin
          .from('pdp_approval_gates')
          .select('id')
          .eq('tenant_id', request.tenant_id)
          .eq('fingerprint', fp)
          .eq('status', 'pending')
          .maybeSingle();
        gateId = raced?.id ?? null;
      } else {
        gateId = created?.id ?? null;
      }
    }
    return { ...result, approval: { gate_id: gateId, approver_role: approverRole, status: 'pending' } };
  } catch (e) {
    console.error('[pdp] approval resolution failed', e);
    return { ...result, approval: { gate_id: null, approver_role: approverRole, status: 'pending' } };
  }
}

/**
 * Entscheidung in-process: Principal anreichern (PIP) → laden (gecacht) →
 * auswerten → Freigabe-Kette → Snapshot sichern.
 */
export async function decide(
  admin: any,
  request: DecisionRequest,
): Promise<DecisionResult> {
  const enriched = await enrichPrincipal(admin, request);
  const snapshot = await loadSnapshot(admin, enriched.tenant_id);
  let result = evaluateSnapshot(snapshot, enriched);
  result = await resolveApproval(admin, enriched, result, snapshot);
  await persistSnapshot(admin, snapshot);
  return result;
}

/**
 * Shadow-Vergleich protokollieren (P0-5). Fehler werden geschluckt und nur
 * geloggt — der Shadow-Mode darf den Alt-Pfad unter keinen Umstaenden
 * beeinflussen, weder im Ergebnis noch durch einen Ausfall.
 */
export async function logShadowComparison(
  admin: any,
  entry: {
    tenant_id: string;
    source: 'telemetry-ai-event' | 'governance-ingest' | 'ai-gateway';
    legacy_status: string | null;
    v2_status: string | null;
    snapshot_version: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await admin.from('pdp_shadow_log').insert({
      tenant_id: entry.tenant_id,
      source: entry.source,
      legacy_status: entry.legacy_status,
      v2_status: entry.v2_status,
      diverged: entry.legacy_status !== entry.v2_status,
      snapshot_version: entry.snapshot_version,
      detail: entry.detail ?? {},
    });
    if (error) console.error('[pdp] shadow log insert failed', error.message);
  } catch (e) {
    console.error('[pdp] shadow log failed', e);
  }
}
