import { describe, it, expect } from 'vitest';
import {
  approvalFingerprint,
  buildSnapshot,
  evaluateSnapshot,
  orgAncestors,
  type DecisionRequest,
} from '../../supabase/functions/_shared/pdp/core';

function request(overrides: Partial<DecisionRequest> = {}): DecisionRequest {
  return {
    contract: 'v1',
    tenant_id: 'tenant-1',
    action: { verb: 'invoke', channel: 'test', event_type: 'prompt_sent' },
    ...overrides,
  };
}

describe('orgAncestors', () => {
  it('zerlegt den materialisierten Pfad von Wurzel bis Blatt', () => {
    expect(orgAncestors('/root/loc-1/dept-9')).toEqual(['root', 'loc-1', 'dept-9']);
    expect(orgAncestors(undefined)).toEqual([]);
    expect(orgAncestors('')).toEqual([]);
  });
});

describe('Principal-Bedingungen (P1-1)', () => {
  const snap = buildSnapshot('t', [], [
    { id: 'g-role', policy_type: 'rolle', action: 'block', enabled: true,
      condition: { principal_roles: ['employee'], vendor: 'OpenAI' } },
    { id: 'g-unit', policy_type: 'standort', action: 'warn', enabled: true,
      condition: { org_unit: 'loc-1' } },
  ]);

  it('matcht Rolle des Principals (Array-Overlap wie die Alt-Semantik)', () => {
    const res = evaluateSnapshot(snap, request({
      principal: { type: 'user', id: 'p1', roles: ['employee', 'approver'] },
      target: { vendor: 'OpenAI' },
    }));
    expect(res.decision).toBe('block');
    expect(res.primary_policy_id).toBe('g-role');
  });

  it('org_unit-Bedingung matcht die Einheit UND ihren Teilbaum', () => {
    const inSubtree = evaluateSnapshot(snap, request({
      principal: { type: 'user', id: 'p1', org_unit: 'dept-9', org_path: '/root/loc-1/dept-9', roles: [] },
    }));
    expect(inSubtree.decision).toBe('warn');
    const outside = evaluateSnapshot(snap, request({
      principal: { type: 'user', id: 'p1', org_unit: 'dept-7', org_path: '/root/loc-2/dept-7', roles: [] },
    }));
    expect(outside.decision).toBe('allow');
  });

  it('K1-Schutz: ohne Principal fallen die Schluessel in payload zurueck (Alt-Semantik)', () => {
    const res = evaluateSnapshot(snap, request({
      payload: { org_unit: 'loc-1' },
    }));
    expect(res.decision).toBe('warn');
    const none = evaluateSnapshot(snap, request({}));
    expect(none.decision).toBe('allow');
  });

  it('approver_role ist Meta-Feld: es matcht nicht, es konfiguriert', () => {
    const s2 = buildSnapshot('t', [], [
      { id: 'g-app', policy_type: 'freigabe', action: 'require_approval', enabled: true,
        condition: { vendor: 'OpenAI', approver_role: 'dpo' } },
    ]);
    const res = evaluateSnapshot(s2, request({ target: { vendor: 'OpenAI' } }));
    expect(res.decision).toBe('require_approval');
    expect(s2.policies[0].approver_role).toBe('dpo');
  });
});

describe('approvalFingerprint (P1-4)', () => {
  const base = request({
    principal: { type: 'user', id: 'p1' },
    target: { vendor: 'OpenAI', model: 'gpt-4.1' },
    data: { classification: 'personal_data', data_types: ['b', 'a'] },
  });

  it('ist deterministisch und unabhaengig von data_types-Reihenfolge und payload', () => {
    const a = approvalFingerprint(base);
    const b = approvalFingerprint({
      ...base,
      data: { ...base.data, data_types: ['a', 'b'] },
      payload: { volatile: Math.PI },
      context: { request_id: 'r-123' },
    });
    expect(a).toBe(b);
    expect(a.startsWith('fp1:')).toBe(true);
  });

  it('aendert sich mit Principal, Ziel, Klassifikation und Kanal', () => {
    const a = approvalFingerprint(base);
    expect(approvalFingerprint({ ...base, principal: { type: 'user', id: 'p2' } })).not.toBe(a);
    expect(approvalFingerprint({ ...base, target: { ...base.target, model: 'gpt-4o' } })).not.toBe(a);
    expect(approvalFingerprint({ ...base, data: { ...base.data, classification: 'internal' } })).not.toBe(a);
    expect(approvalFingerprint({ ...base, action: { ...base.action, channel: 'other' } })).not.toBe(a);
  });

  it('Vendor-Gross/Kleinschreibung aendert den Fingerprint nicht', () => {
    expect(approvalFingerprint({ ...base, target: { ...base.target, vendor: 'openai' } }))
      .toBe(approvalFingerprint(base));
  });
});
