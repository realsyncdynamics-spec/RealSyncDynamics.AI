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
  buildSnapshot,
  evaluateSnapshot,
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

/** Entscheidung in-process: laden (gecacht) → auswerten → Snapshot sichern. */
export async function decide(
  admin: any,
  request: DecisionRequest,
): Promise<DecisionResult> {
  const snapshot = await loadSnapshot(admin, request.tenant_id);
  const result = evaluateSnapshot(snapshot, request);
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
