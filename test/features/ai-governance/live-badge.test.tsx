/**
 * AI-Governance-Abschnitt (/features, AiGovernancePage): „LIVE“ nur, wenn
 * nichts Beispieldaten ist. Vorher genügte eine echte Zeile — die drei
 * globalen Standard-Policies sieht jeder angemeldete Nutzer, also stand
 * „LIVE“ über Demo-Systemen wie „HR Screening Assistant“.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const tables = vi.hoisted(() => ({
  ai_systems: { data: [] as unknown[], error: null as unknown },
  ai_policies: { data: [] as unknown[], error: null as unknown },
  ai_evidence_events: { data: [] as unknown[], error: null as unknown },
}));

function query(table: keyof typeof tables) {
  const result = () => Promise.resolve(tables[table]);
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order']) chain[m] = () => chain;
  chain.limit = result;
  return chain;
}

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({ from: (t: keyof typeof tables) => query(t) }),
}));

import { useAiGovernanceData } from '../../../src/features/ai-governance/useAiGovernanceData';
import { demoAiSystems } from '../../../src/features/ai-governance/demoData';

const system = { id: 's1', name: 'Echtes System', vendor: 'x', model_name: null, department: null, owner_email: null, purpose: null, data_types: [], ai_act_class: 'minimal', risk_score: 1, status: 'active' };
const policy = { id: 'p1', name: 'Standard', description: null, severity: 'high', rule_type: 'model_usage', action: 'warn', enabled: true };
const event = { id: 'e1', ai_system_id: 's1', policy_id: null, event_type: 'x', event_summary: 'y', risk_level: 'low', evidence: {}, created_at: '2026-10-01T00:00:00Z' };

beforeEach(() => {
  tables.ai_systems = { data: [], error: null };
  tables.ai_policies = { data: [], error: null };
  tables.ai_evidence_events = { data: [], error: null };
});

describe('useAiGovernanceData — LIVE nur ohne Beispieldaten', () => {
  it('nur globale Standard-Policies echt: Demo-Systeme sichtbar, also nicht LIVE', async () => {
    tables.ai_policies = { data: [policy], error: null };
    const { result } = renderHook(() => useAiGovernanceData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.aiSystems).toEqual(demoAiSystems);
    expect(result.current.live).toBe(false);
  });

  it('alle drei Listen echt: LIVE', async () => {
    tables.ai_systems = { data: [system], error: null };
    tables.ai_policies = { data: [policy], error: null };
    tables.ai_evidence_events = { data: [event], error: null };
    const { result } = renderHook(() => useAiGovernanceData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.live).toBe(true);
    expect(result.current.aiSystems.map((s) => s.name)).toEqual(['Echtes System']);
  });

  it('ein Lesefehler: nicht LIVE', async () => {
    tables.ai_systems = { data: [system], error: null };
    tables.ai_policies = { data: [policy], error: null };
    tables.ai_evidence_events = { data: [event], error: { message: 'rls' } };
    const { result } = renderHook(() => useAiGovernanceData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.live).toBe(false);
  });
});
