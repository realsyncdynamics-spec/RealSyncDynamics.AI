// Supabase-gestütztes MonitorRepo. Nimmt den service_role-Client strukturell
// (kein jsr-Import), damit das Modul vitest-importierbar bleibt. Der Client
// entsteht in index.ts erst NACH der Cron-Auth.

import type { AlertRecord, MonitorRepo } from './handler.ts';
import type { MonitoredDomain } from './logic.ts';

// deno-lint-ignore no-explicit-any
export type ServiceClient = { from(table: string): any; rpc(fn: string, args: Record<string, unknown>): any };
type PgResult<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(r: PgResult<T>, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? ([] as unknown)) as T;
}

export function createSupabaseRepo(db: ServiceClient): MonitorRepo {
  return {
    async listActiveDomains() {
      const r: PgResult<MonitoredDomain[]> = await db.from('monitored_domains')
        .select('id, tenant_id, domain, tier, active, alert_email, last_scan_at, last_risk_score, last_trackers, created_at')
        .eq('active', true)
        .order('last_scan_at', { ascending: true, nullsFirst: true })
        .limit(2000);
      return unwrap(r, 'monitored_domains');
    },
    async latestEvidenceHash(tenantId) {
      const r: PgResult<Array<{ content_hash: string | null }>> = await db.from('governance_evidence')
        .select('content_hash')
        .eq('tenant_id', tenantId)
        .not('content_hash', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
      return unwrap(r, 'governance_evidence')[0]?.content_hash ?? null;
    },
    async appendEvidence(row, expectedPreviousHash) {
      const r: PgResult<string | null> = await db.rpc('append_governance_evidence', {
        p_row: row, p_expected_previous_hash: expectedPreviousHash,
      });
      if (r.error) throw new Error(`append_governance_evidence: ${r.error.message}`);
      return r.data ? { id: r.data } : 'conflict';
    },
    async insertResult(row) {
      unwrap(await db.from('audit_monitor_results').insert(row), 'audit_monitor_results insert');
    },
    async updateDomainState(id, patch) {
      unwrap(await db.from('monitored_domains').update(patch).eq('id', id), 'monitored_domains update');
    },
    async enqueueAlert(row) {
      // Duplikat (gleiche Domain + Fingerabdruck) wird übersprungen; dann den
      // vorhandenen Datensatz lesen, damit der Handler dessen Status sieht.
      const ins: PgResult<AlertRecord[]> = await db.from('audit_monitor_alerts')
        .upsert(row, { onConflict: 'monitored_domain_id,fingerprint', ignoreDuplicates: true })
        .select(ALERT_COLUMNS);
      const created = unwrap(ins, 'audit_monitor_alerts insert')[0];
      if (created) return created;
      const ex: PgResult<AlertRecord[]> = await db.from('audit_monitor_alerts')
        .select(ALERT_COLUMNS)
        .eq('monitored_domain_id', row.monitored_domain_id)
        .eq('fingerprint', row.fingerprint)
        .limit(1);
      const existing = unwrap(ex, 'audit_monitor_alerts select')[0];
      if (!existing) throw new Error('audit_monitor_alerts: insert returned nothing and no existing row');
      return existing;
    },
    async pendingAlerts(limit) {
      const r: PgResult<AlertRecord[]> = await db.from('audit_monitor_alerts')
        .select(ALERT_COLUMNS)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);
      return unwrap(r, 'audit_monitor_alerts pending');
    },
    async markAlert(id, patch) {
      unwrap(await db.from('audit_monitor_alerts').update(patch).eq('id', id), 'audit_monitor_alerts update');
    },
  };
}

const ALERT_COLUMNS = 'id, monitored_domain_id, tenant_id, domain, recipient, fingerprint, payload, status, attempts';
