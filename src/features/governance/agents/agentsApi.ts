// Persistenz-API für das Agenten-Register (Tabelle governance_agents).
// RLS schützt pro Tenant; daher direkte Tabellen-Queries via getSupabase().
import { getSupabase } from '../../../lib/supabase';
import { DEMO_AGENTS } from './demoAgents';
import type { AgentStatus, GovernanceAgent } from './types';

const COLUMNS =
  'id,agent_key,name,description,type,status,risk_level,tools,permissions,' +
  'restricted_actions,requires_human_review,evidence_refs,owner_role,last_run_at,sort_order';

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function rowToAgent(r: any): GovernanceAgent {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    status: r.status,
    riskLevel: r.risk_level,
    tools: r.tools ?? [],
    permissions: r.permissions ?? [],
    restrictedActions: r.restricted_actions ?? [],
    requiresHumanReview: r.requires_human_review ?? [],
    lastRunAt: r.last_run_at ?? null,
    ownerRole: r.owner_role,
    evidenceRefs: r.evidence_refs ?? [],
    description: r.description ?? '',
  };
}

function agentToSeedRow(a: GovernanceAgent, tenantId: string, idx: number) {
  return {
    tenant_id: tenantId,
    agent_key: a.id,
    name: a.name,
    description: a.description,
    type: a.type,
    status: a.status,
    risk_level: a.riskLevel,
    tools: a.tools,
    permissions: a.permissions,
    restricted_actions: a.restrictedActions,
    requires_human_review: a.requiresHumanReview,
    evidence_refs: a.evidenceRefs,
    owner_role: a.ownerRole,
    last_run_at: a.lastRunAt,
    sort_order: (idx + 1) * 10,
  };
}

/**
 * Lädt das Agenten-Register eines Tenants. Existiert noch keines, wird das
 * Default-Set (DEMO_AGENTS) einmalig angelegt (seed-on-read) und zurückgegeben.
 */
export async function loadAgents(tenantId: string): Promise<GovernanceAgent[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('governance_agents')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data.map(rowToAgent);

  // Seed-on-read: Default-Agenten anlegen (idempotent gegen Races).
  const seed = DEMO_AGENTS.map((a, i) => agentToSeedRow(a, tenantId, i));
  const { error: seedErr } = await sb
    .from('governance_agents')
    .upsert(seed, { onConflict: 'tenant_id,agent_key', ignoreDuplicates: true });
  if (seedErr) throw new Error(seedErr.message);

  const { data: seeded, error: reloadErr } = await sb
    .from('governance_agents')
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (reloadErr) throw new Error(reloadErr.message);
  return (seeded ?? []).map(rowToAgent);
}

/** Setzt den Status eines Agenten (persistiert). */
export async function setAgentStatus(id: string, status: AgentStatus): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from('governance_agents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
