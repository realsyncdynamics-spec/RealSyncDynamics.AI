// Supabase-backed AuditRepo for tenant-audit (Gate 2). Takes the service_role
// client structurally (no jsr import), so vitest can import the module. Every
// query is tenant-scoped: the caller's membership was checked in index.ts, and
// websites are looked up by id AND tenant_id, never by id alone.

import type { AuditRepo, TrackedFinding, TrackedStatus, WebsiteRow } from './pipeline.ts';
import { DETECTOR } from './pipeline.ts';

// deno-lint-ignore no-explicit-any
export type ServiceClient = { from(table: string): any; rpc(fn: string, args: Record<string, unknown>): any };

type PgResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function unwrap<T>(r: PgResult<T>, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? ([] as unknown)) as T;
}

const TRACKED: TrackedStatus[] = ['open', 'acknowledged', 'fixed', 'false_positive', 'ignored'];
const TRACKED_PAGE = 1000;

/** LIKE pattern for `gdpr_audit.<issue>:<host>`; `_`, `%` and `\` in the host are escaped. */
export function trackedKeyPattern(host: string): string {
  return `gdpr\\_audit.%:${host.replace(/[\\%_]/g, (c) => `\\${c}`)}`;
}

export function createAuditRepo(db: ServiceClient): AuditRepo {
  return {
    async findWebsite(tenantId, websiteId) {
      const r: PgResult<WebsiteRow[]> = await db.from('websites')
        .select('id, domain, governance_asset_id')
        .eq('tenant_id', tenantId)
        .eq('id', websiteId)
        .limit(1);
      return unwrap(r, 'websites')[0] ?? null;
    },

    async listWebsites(tenantId) {
      const r: PgResult<WebsiteRow[]> = await db.from('websites')
        .select('id, domain, governance_asset_id')
        .eq('tenant_id', tenantId)
        .limit(500);
      return unwrap(r, 'websites');
    },

    async latestEvidenceHash(tenantId) {
      const r: PgResult<Array<{ content_hash: string | null }>> = await db.from('governance_evidence')
        .select('content_hash')
        .eq('tenant_id', tenantId)
        .not('content_hash', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      return unwrap(r, 'governance_evidence')[0]?.content_hash ?? null;
    },

    async appendEvidence(row, expectedPreviousHash) {
      const r: PgResult<string | null> = await db.rpc('append_governance_evidence', {
        p_row: row,
        p_expected_previous_hash: expectedPreviousHash,
      });
      if (r.error) throw new Error(`append_governance_evidence: ${r.error.message}`);
      return r.data ? { id: r.data } : 'conflict';
    },

    async listTrackedFindings(tenantId, host) {
      // Paged: reconciliation needs the complete set — a truncated list would
      // leave absent findings unresolved and send observed ones into insert.
      const out: TrackedFinding[] = [];
      for (let offset = 0; ; offset += TRACKED_PAGE) {
        const r: PgResult<TrackedFinding[]> = await db.from('findings')
          .select('id, dedupe_key, status, raw_payload')
          .eq('tenant_id', tenantId)
          .eq('detector', DETECTOR)
          .in('status', TRACKED)
          .like('dedupe_key', trackedKeyPattern(host))
          .order('id', { ascending: true })
          .range(offset, offset + TRACKED_PAGE - 1);
        const page = unwrap(r, 'findings');
        out.push(...page);
        if (page.length < TRACKED_PAGE) return out;
      }
    },

    async insertFinding(row) {
      const r: PgResult<{ id: string }> = await db.from('findings').insert(row).select('id').single();
      if (r.error?.code === '23505') return 'conflict';
      return unwrap(r, 'findings insert');
    },

    async updateFinding(id, expectStatus, patch) {
      const r: PgResult<Array<{ id: string }>> = await db.from('findings')
        .update(patch)
        .eq('id', id)
        .eq('status', expectStatus)
        .select('id');
      return unwrap(r, 'findings update').length;
    },
  };
}
