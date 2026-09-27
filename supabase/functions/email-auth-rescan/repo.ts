// Supabase-backed RescanRepo. Takes the service_role client structurally (no
// jsr import here), so the module stays vitest-importable. The client is
// only created in index.ts AFTER the cron bearer check passed.
//
// Every query is tenant-scoped except the two target listings, which are the
// cron's global work list (website governance_assets + websites).

import type { OpenFindingRow, RescanRepo } from './handler.ts';
import type { AssetRow, EventRow, WebsiteRow } from './logic.ts';
import { EVENT_FINDING, EVENT_RESOLVED } from './logic.ts';

// deno-lint-ignore no-explicit-any
export type ServiceClient = { from(table: string): any };

type PgResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function unwrap<T>(r: PgResult<T>, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? ([] as unknown)) as T;
}

export function createSupabaseRepo(db: ServiceClient): RescanRepo {
  return {
    async listWebsiteAssets() {
      const r: PgResult<AssetRow[]> = await db.from('governance_assets')
        .select('id, tenant_id, system_url, name')
        .eq('asset_type', 'website')
        .or('status.is.null,status.neq.archived')
        .limit(2000);
      return unwrap(r, 'governance_assets');
    },

    async listWebsites() {
      const r: PgResult<WebsiteRow[]> = await db.from('websites')
        .select('id, tenant_id, domain, governance_asset_id')
        .neq('status', 'churned')
        .limit(2000);
      return unwrap(r, 'websites');
    },

    async listEmailAuthEvents(tenantId) {
      const r: PgResult<EventRow[]> = await db.from('governance_events')
        .select('id, asset_id, event_type, payload, created_at')
        .eq('tenant_id', tenantId)
        .in('event_type', [EVENT_FINDING, EVENT_RESOLVED])
        .order('created_at', { ascending: true })
        .limit(5000);
      return unwrap(r, 'governance_events');
    },

    async listOpenEmailAuthFindings(tenantId) {
      const r: PgResult<OpenFindingRow[]> = await db.from('findings')
        .select('id, dedupe_key, status, asset_id, raw_payload')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'acknowledged'])
        .like('dedupe_key', 'email\\_auth.%')
        .limit(1000);
      return unwrap(r, 'findings');
    },

    async latestEvidenceHash(tenantId) {
      const r: PgResult<Array<{ content_hash: string | null }>> = await db.from('governance_evidence')
        .select('content_hash')
        .eq('tenant_id', tenantId)
        .not('content_hash', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const rows = unwrap(r, 'governance_evidence');
      return rows[0]?.content_hash ?? null;
    },

    async insertEvidence(row) {
      const r: PgResult<{ id: string }> = await db.from('governance_evidence').insert(row).select('id').single();
      return unwrap(r, 'governance_evidence insert');
    },

    async insertEvent(row) {
      const r: PgResult<{ id: string }> = await db.from('governance_events').insert(row).select('id').single();
      return unwrap(r, 'governance_events insert');
    },

    async insertFinding(row) {
      const r: PgResult<{ id: string }> = await db.from('findings').insert(row).select('id').single();
      if (r.error?.code === '23505') return 'conflict';
      return unwrap(r, 'findings insert');
    },

    async updateOpenFinding(id, patch) {
      const r: PgResult<unknown> = await db.from('findings')
        .update(patch)
        .eq('id', id)
        .in('status', ['open', 'acknowledged']);
      unwrap(r, 'findings update');
    },

    async resolveFinding(id, resolvedAt) {
      const r: PgResult<unknown> = await db.from('findings')
        .update({ status: 'resolved', resolved_at: resolvedAt })
        .eq('id', id)
        .in('status', ['open', 'acknowledged']);
      unwrap(r, 'findings resolve');
    },
  };
}
