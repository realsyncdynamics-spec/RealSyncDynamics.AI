// Supabase-Anbindung für provision-voice-agent (Service-Role).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { readVoiceEntitlements, type EntitlementLike } from '../_shared/voice-agent-provisioning.ts';
import type { ProvisionRepo, VoiceAgentRow } from './handler.ts';

// Ein Literal (keine Verkettung): supabase-js leitet den Zeilentyp aus dem
// String-Literal ab, ein verketteter `string` ergibt GenericStringError.
const COLUMNS = 'id, tenant_id, bot_id, provider, provider_agent_id, template_agent_id, desired_state, status, stripe_subscription_id, last_stripe_event_id, attempts, claimed_at';

interface PgResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

function unwrap<T>(r: PgResult<T>, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

export function createSupabaseRepo(db: SupabaseClient): ProvisionRepo {
  return {
    async getByTenant(tenantId) {
      const r: PgResult<VoiceAgentRow> = await db.from('tenant_voice_agents')
        .select(COLUMNS).eq('tenant_id', tenantId).maybeSingle();
      return unwrap(r, 'tenant_voice_agents');
    },

    async listOpen(staleBefore, maxAttempts, limit) {
      const r: PgResult<VoiceAgentRow[]> = await db.from('tenant_voice_agents')
        .select(COLUMNS)
        .or(
          `status.eq.pending,` +
          `and(status.eq.failed,attempts.lt.${maxAttempts}),` +
          `and(status.eq.provisioning,claimed_at.lt.${staleBefore})`,
        )
        .order('updated_at', { ascending: true })
        .limit(limit);
      return unwrap(r, 'tenant_voice_agents') ?? [];
    },

    async claim(row, nowIso, staleBefore) {
      // Die WHERE-Bedingung wird nach dem Row-Lock neu ausgewertet: ein
      // zweiter, gleichzeitiger Lauf findet die Zeile nicht mehr offen vor.
      const r: PgResult<VoiceAgentRow[]> = await db.from('tenant_voice_agents')
        .update({ status: 'provisioning', claimed_at: nowIso, attempts: row.attempts + 1 })
        .eq('id', row.id)
        .eq('attempts', row.attempts)
        .or(`status.in.(pending,failed),and(status.eq.provisioning,claimed_at.lt.${staleBefore})`)
        .select(COLUMNS);
      const rows = unwrap(r, 'tenant_voice_agents claim') ?? [];
      return rows[0] ?? null;
    },

    async update(id, patch) {
      const r: PgResult<unknown> = await db.from('tenant_voice_agents').update(patch).eq('id', id);
      unwrap(r, 'tenant_voice_agents update');
    },

    async finish(id, claimedAt, patch) {
      const r: PgResult<Array<{ id: string }>> = await db.from('tenant_voice_agents')
        .update(patch)
        .eq('id', id)
        .eq('status', 'provisioning')
        .eq('claimed_at', claimedAt)
        .select('id');
      return (unwrap(r, 'tenant_voice_agents finish') ?? []).length > 0;
    },

    async loadVoiceEntitlements(tenantId) {
      const r: PgResult<EntitlementLike[]> = await db.rpc('tenant_entitlements', { p_tenant_id: tenantId });
      return readVoiceEntitlements(unwrap(r, 'tenant_entitlements') ?? []);
    },

    async tenantName(tenantId) {
      const r: PgResult<{ name: string | null }> = await db.from('tenants')
        .select('name').eq('id', tenantId).maybeSingle();
      return unwrap(r, 'tenants')?.name ?? null;
    },

    async createVoiceBot(tenantId, name) {
      // Der Quota-Trigger auf public.bots (bots.enabled / limit.bots) gilt
      // auch hier — scheitert er, wird die Zeile 'failed' mit Grund.
      const r: PgResult<{ id: string }> = await db.from('bots').insert({
        tenant_id: tenantId,
        name,
        channel: 'voice',
        description: 'Automatisch bereitgestellter Voice-Agent (ElevenLabs).',
        enabled: false,
        config: { provider: 'elevenlabs' },
      }).select('id').single();
      return unwrap(r, 'bots insert').id;
    },

    async setBotState(botId, enabled, config) {
      const r: PgResult<unknown> = await db.from('bots').update({ enabled, config }).eq('id', botId);
      unwrap(r, 'bots update');
    },

    async latestEvidenceHash(tenantId) {
      const r: PgResult<Array<{ content_hash: string | null }>> = await db.from('governance_evidence')
        .select('content_hash')
        .eq('tenant_id', tenantId)
        .not('content_hash', 'is', null)
        // Gleiche Reihenfolge wie append_governance_evidence.
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
      return unwrap(r, 'governance_evidence')?.[0]?.content_hash ?? null;
    },

    async appendEvidence(row, expectedPreviousHash) {
      const r: PgResult<string | null> = await db.rpc('append_governance_evidence', {
        p_row: row,
        p_expected_previous_hash: expectedPreviousHash,
      });
      if (r.error) throw new Error(`append_governance_evidence: ${r.error.message}`);
      return r.data ? { id: r.data } : 'conflict';
    },
  };
}
