import { describe, it, expect } from 'vitest';
import {
  buildSnapshot,
  compileAiPolicies,
  compileGovernancePolicies,
  evaluateSnapshot,
  snapshotFailMode,
  snapshotVersion,
  toLegacyAiStatus,
  toLegacyGovAction,
  type AiPolicyRowInput,
  type DecisionRequest,
  type GovernancePolicyRowInput,
} from '../../supabase/functions/_shared/pdp/core';
import {
  evaluatePolicies as evaluateLegacyAi,
  type PolicyRule as LegacyAiPolicy,
  type RuntimeEventInput,
} from '../../supabase/functions/_shared/policy-engine';
import {
  evaluatePolicies as evaluateLegacyGov,
  type PolicyRow as LegacyGovPolicy,
  type EventForEval,
} from '../../supabase/functions/_shared/policyEngine';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: 'tenant-1',
    action: { verb: 'invoke', channel: 'test', event_type: 'prompt_sent' },
    ...overrides,
  };
}

function aiRow(overrides: Partial<AiPolicyRowInput> = {}): AiPolicyRowInput {
  return {
    id: 'p1',
    name: 'Testpolicy',
    rule_type: 'vendor_restriction',
    action: 'block',
    enabled: true,
    condition: { blocked_vendors: ['openai'] },
    ...overrides,
  };
}

function govRow(overrides: Partial<GovernancePolicyRowInput> = {}): GovernancePolicyRowInput {
  return {
    id: 'g1',
    policy_type: 'data_transfer',
    action: 'block',
    enabled: true,
    condition: { vendor: 'OpenAI' },
    ...overrides,
  };
}

// ─── Kompilierung ────────────────────────────────────────────────────────────

describe('pdp-core Kompilierung', () => {
  it('ueberspringt disabled Policies', () => {
    expect(compileAiPolicies([aiRow({ enabled: false })])).toHaveLength(0);
    expect(compileGovernancePolicies([govRow({ enabled: false })])).toHaveLength(0);
  });

  it('ueberspringt unbekannte rule_types (wie die Alt-Engine: matched nie)', () => {
    expect(compileAiPolicies([aiRow({ rule_type: 'does_not_exist' })])).toHaveLength(0);
  });

  it('normalisiert log → log_only', () => {
    const [p] = compileGovernancePolicies([govRow({ action: 'log' })]);
    expect(p.action).toBe('log_only');
  });

  it('Snapshot-Version ist deterministisch und aendert sich mit dem Inhalt', () => {
    const a = compileAiPolicies([aiRow()]);
    const b = compileAiPolicies([aiRow({ id: 'p2' })]);
    expect(snapshotVersion(a)).toBe(snapshotVersion(a));
    expect(snapshotVersion(a)).not.toBe(snapshotVersion(b));
  });
});

// ─── Ausfallverhalten (Plan K3) ──────────────────────────────────────────────

describe('pdp-core Ausfallverhalten', () => {
  it('Default: fail open — ausser die Policy blockiert selbst', () => {
    const warn = buildSnapshot('t', [aiRow({ action: 'warn' })], []);
    const block = buildSnapshot('t', [aiRow({ action: 'block' })], []);
    expect(snapshotFailMode(warn)).toBe('allow');
    expect(snapshotFailMode(block)).toBe('block');
  });

  it('on_engine_unavailable in der Condition ueberschreibt den Default', () => {
    const snap = buildSnapshot('t', [
      aiRow({ action: 'block', condition: { blocked_vendors: ['openai'], on_engine_unavailable: 'allow' } }),
    ], []);
    expect(snapshotFailMode(snap)).toBe('allow');
  });
});

// ─── Auswertung ──────────────────────────────────────────────────────────────

describe('pdp-core Auswertung', () => {
  it('kein Match ⇒ allow, cachebar, ohne Begruendung', () => {
    const snap = buildSnapshot('t', [aiRow()], []);
    const res = evaluateSnapshot(snap, request({ target: { vendor: 'anthropic' } }));
    expect(res.decision).toBe('allow');
    expect(res.reasons).toHaveLength(0);
    expect(res.ttl_ms).toBeGreaterThan(0);
    expect(toLegacyAiStatus(res)).toBe('logged');
    expect(toLegacyGovAction(res)).toBeNull();
  });

  it('block gewinnt ueber warn; block wird nicht gecacht', () => {
    const snap = buildSnapshot('t', [
      aiRow({ id: 'w', rule_type: 'model_usage', action: 'warn', condition: {} }),
      aiRow({ id: 'b', action: 'block', condition: { blocked_vendors: ['openai'] } }),
    ], []);
    const res = evaluateSnapshot(snap, request({ target: { vendor: 'OpenAI' } }));
    expect(res.decision).toBe('block');
    expect(res.primary_policy_id).toBe('b');
    expect(res.matched_policy_ids).toEqual(['b', 'w']);
    expect(res.ttl_ms).toBe(0);
  });

  it('Quellen mischen: strengste Entscheidung ueber beide Alt-Formate', () => {
    const snap = buildSnapshot('t',
      [aiRow({ id: 'a', action: 'warn', condition: {} })],
      [govRow({ id: 'g', action: 'require_approval', condition: { event_type: 'prompt_sent' } })],
    );
    const res = evaluateSnapshot(snap, request());
    expect(res.decision).toBe('require_approval');
    expect(res.primary_policy_id).toBe('g');
  });

  it('Begruendung ist deutsch und nennt die Policy', () => {
    const snap = buildSnapshot('t', [aiRow({ name: 'Keine US-Anbieter' })], []);
    const res = evaluateSnapshot(snap, request({ target: { vendor: 'openai' } }));
    expect(res.reasons[0].text_de).toContain('Keine US-Anbieter');
    expect(res.reasons[0].text_de).toContain('blockiert');
  });

  it('generic_condition: Asset-Felder, Array-Overlap und payload-Fallback', () => {
    const snap = buildSnapshot('t', [], [
      govRow({ id: 'g1', condition: { ai_act_class: 'high', data_types: ['customer_data'] } }),
      govRow({ id: 'g2', action: 'warn', condition: { custom_flag: true } }),
    ]);
    const res = evaluateSnapshot(snap, request({
      asset: { id: 'a1', ai_act_class: 'high' },
      data: { data_types: ['customer_data', 'other'] },
      payload: { custom_flag: true },
    }));
    expect(res.decision).toBe('block');
    expect(res.matched_policy_ids).toEqual(['g1', 'g2']);
  });
});

// ─── Aequivalenz gegen die Alt-Engines (Plan P0-2: Shadow-Grundlage) ─────────

describe('pdp-core Aequivalenz mit policy-engine.ts (ai_policies)', () => {
  const policies: LegacyAiPolicy[] = [
    { id: 'p1', name: 'ext-pii', rule_type: 'data_transfer', action: 'block', enabled: true,
      condition: { data_classes: ['personal_data', 'special_category'], to_external_vendor: true } },
    { id: 'p2', name: 'vendors', rule_type: 'vendor_restriction', action: 'warn', enabled: true,
      condition: { allowed_vendors: ['anthropic'] } },
    { id: 'p3', name: 'review', rule_type: 'human_review', action: 'require_approval', enabled: true,
      condition: { risk_levels: ['high', 'critical'] } },
    { id: 'p4', name: 'log-tools', rule_type: 'logging_required', action: 'allow', enabled: true,
      condition: { event_types: ['tool_call'] } },
    { id: 'p5', name: 'off', rule_type: 'model_usage', action: 'block', enabled: false,
      condition: {} },
  ];

  const events: RuntimeEventInput[] = [
    { vendor: 'openai', event_type: 'prompt_sent', data_class: 'personal_data' },
    { vendor: 'anthropic', event_type: 'prompt_sent', data_class: 'internal' },
    { vendor: 'google', event_type: 'tool_call', risk_level: 'high' },
    { vendor: undefined, event_type: 'session_start' },
    { vendor: 'ollama', event_type: 'prompt_sent', data_class: 'personal_data' },
    { vendor: 'perplexity', event_type: 'response_received', risk_level: 'critical', prompt_category: 'analysis' },
  ];

  const snap = buildSnapshot('t', policies.map((p) => ({
    id: p.id, name: p.name, rule_type: p.rule_type, action: p.action,
    enabled: p.enabled, condition: p.condition as Record<string, unknown>,
  })), []);

  it.each(events.map((e, i) => [i, e] as const))('Event %i: v2 == Alt-Engine', (_i, e) => {
    const legacy = evaluateLegacyAi(e, policies);
    const v2 = evaluateSnapshot(snap, request({
      action: { verb: 'invoke', channel: 'test', event_type: e.event_type },
      target: { vendor: e.vendor, model: e.model },
      data: { classification: e.data_class, risk_level: e.risk_level, prompt_category: e.prompt_category },
    }));
    expect(toLegacyAiStatus(v2)).toBe(legacy.status);
    expect(v2.primary_policy_id ?? undefined).toBe(legacy.matched_policy_id);
  });
});

describe('pdp-core Aequivalenz mit policyEngine.ts (governance_policies)', () => {
  const policies: LegacyGovPolicy[] = [
    { id: 'g1', tenant_id: 't', policy_type: 'transfer', severity: 'high', action: 'block',
      condition: { vendor: 'OpenAI', data_types: ['customer_data'] }, enabled: true },
    { id: 'g2', tenant_id: 't', policy_type: 'source', severity: 'low', action: 'warn',
      condition: { event_source: 'agent_runtime' }, enabled: true },
    { id: 'g3', tenant_id: 't', policy_type: 'payload', severity: 'low', action: 'require_approval',
      condition: { deploy_target: 'production' }, enabled: true },
  ];

  const events: EventForEval[] = [
    { event_type: 'deploy', event_source: 'agent_runtime', vendor: 'OpenAI', data_types: ['customer_data'] },
    { event_type: 'deploy', event_source: 'ci', vendor: 'OpenAI', data_types: ['telemetry'] },
    { event_type: 'deploy', event_source: 'ci', payload: { deploy_target: 'production' } },
    { event_type: 'scan', event_source: 'scanner' },
  ];

  const snap = buildSnapshot('t', [], policies.map((p) => ({
    id: p.id, policy_type: p.policy_type, action: p.action,
    enabled: p.enabled, condition: p.condition as Record<string, unknown>,
  })));

  it.each(events.map((e, i) => [i, e] as const))('Event %i: v2 == Alt-Engine', (_i, e) => {
    const legacy = evaluateLegacyGov(e, null, policies);
    const v2 = evaluateSnapshot(snap, request({
      action: { verb: 'invoke', channel: 'test', event_type: e.event_type, event_source: e.event_source },
      target: { vendor: e.vendor ?? undefined, model: e.model_name ?? undefined },
      data: { data_types: e.data_types, risk_level: e.risk_level },
      payload: e.payload,
    }));
    expect(toLegacyGovAction(v2)).toBe(legacy ? legacy.action : null);
    expect(v2.primary_policy_id).toBe(legacy?.policy_id ?? null);
  });
});
