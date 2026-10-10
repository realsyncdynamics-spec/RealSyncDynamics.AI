// Supabase-gestütztes MonitorRepo. Nimmt den service_role-Client strukturell
// (kein jsr-Import), damit das Modul vitest-importierbar bleibt. Der Client
// entsteht in index.ts erst NACH der Cron-Auth.

import type { MonitorRepo } from './handler.ts';
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
  };
}
