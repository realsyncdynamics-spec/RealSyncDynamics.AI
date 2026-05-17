// OutputAgent — unit tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputAgent } from '../../../src/core/output-agent/output';
import type { ObservationLike, ChannelTransport, DeliveryRecord } from '../../../src/core/output-agent/types';

const TENANT = '00000000-0000-0000-0000-000000000001';

let agent: OutputAgent;

beforeEach(() => {
  agent = new OutputAgent();
});

function obs(over: Partial<ObservationLike> = {}): ObservationLike {
  return {
    id:        over.id ?? 'obs_1',
    tenant_id: over.tenant_id ?? TENANT,
    severity:  over.severity ?? 'high',
    title:     over.title ?? 'SLO breach',
    detail:    over.detail ?? 'detail',
    ...over,
  };
}

// ── addChannel ────────────────────────────────────────────────────

describe('OutputAgent.addChannel', () => {
  it('creates a channel with defaults', () => {
    const c = agent.addChannel({ tenant_id: TENANT, name: 'slack-ops', kind: 'slack' });
    expect(c.min_severity).toBe('high');
    expect(c.rate_limit_per_hour).toBe(20);
    expect(c.enabled).toBe(true);
  });

  it('rejects duplicate names per tenant', () => {
    agent.addChannel({ tenant_id: TENANT, name: 'x', kind: 'slack' });
    expect(() => agent.addChannel({ tenant_id: TENANT, name: 'x', kind: 'email' }))
      .toThrow(/already exists/);
  });

  it('rejects rate_limit_per_hour out of bounds', () => {
    expect(() => agent.addChannel({ tenant_id: TENANT, name: 'a', kind: 'slack', rate_limit_per_hour: 0 }))
      .toThrow(/rate_limit/);
    expect(() => agent.addChannel({ tenant_id: TENANT, name: 'b', kind: 'slack', rate_limit_per_hour: 9999 }))
      .toThrow(/rate_limit/);
  });
});

// ── deliver — happy path ──────────────────────────────────────────

describe('OutputAgent.deliver — happy path', () => {
  it('fans out to every enabled tenant channel above min_severity', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'slack',   kind: 'slack',   min_severity: 'high' });
    agent.addChannel({ tenant_id: TENANT, name: 'email',   kind: 'email',   min_severity: 'medium' });
    agent.addChannel({ tenant_id: TENANT, name: 'webhook', kind: 'webhook', min_severity: 'critical' });

    const records = await agent.deliver(obs({ severity: 'high' }));
    expect(records).toHaveLength(3);
    const slack   = records.find(r => r.title === 'SLO breach' && r.error_message === null && r.status === 'delivered');
    expect(slack).toBeDefined();
    const skipped = records.find(r => r.status === 'skipped_severity');
    expect(skipped).toBeDefined();
  });

  it('skips disabled channels entirely', async () => {
    const c = agent.addChannel({ tenant_id: TENANT, name: 'x', kind: 'slack' });
    agent.setEnabled(c.id, false);
    const records = await agent.deliver(obs());
    expect(records).toHaveLength(0);
  });

  it('tenant isolation — channels from other tenants ignored', async () => {
    const OTHER = '00000000-0000-0000-0000-000000000002';
    agent.addChannel({ tenant_id: OTHER, name: 'foreign', kind: 'slack' });
    const records = await agent.deliver(obs({ tenant_id: TENANT }));
    expect(records).toHaveLength(0);
  });
});

// ── Severity filtering ────────────────────────────────────────────

describe('OutputAgent.deliver — severity filtering', () => {
  it("records 'skipped_severity' when obs severity below channel min", async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'high-only', kind: 'slack', min_severity: 'high' });
    const records = await agent.deliver(obs({ severity: 'medium' }));
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('skipped_severity');
    expect(records[0].error_message).toMatch(/below channel min/);
  });

  it('routes critical to a high-min channel (rank above threshold)', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'high-only', kind: 'slack', min_severity: 'high' });
    const records = await agent.deliver(obs({ severity: 'critical' }));
    expect(records[0].status).toBe('delivered');
  });
});

// ── Rate limiting ─────────────────────────────────────────────────

describe('OutputAgent.deliver — rate limiting', () => {
  it("returns 'rate_limited' once the hourly cap is hit", async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'capped', kind: 'slack', rate_limit_per_hour: 2 });
    const r1 = await agent.deliver(obs({ id: 'o1' }));
    const r2 = await agent.deliver(obs({ id: 'o2' }));
    const r3 = await agent.deliver(obs({ id: 'o3' }));
    expect(r1[0].status).toBe('delivered');
    expect(r2[0].status).toBe('delivered');
    expect(r3[0].status).toBe('rate_limited');
    expect(r3[0].error_message).toMatch(/rate limit/);
  });

  it('rate-limited count counts only delivered (not skipped) rows', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'capped', kind: 'slack', rate_limit_per_hour: 1, min_severity: 'high' });
    // First a sub-threshold obs (skipped, doesn't count toward limit)
    await agent.deliver(obs({ id: 'o1', severity: 'low' }));
    await agent.deliver(obs({ id: 'o2', severity: 'low' }));
    // Now a high obs — should still deliver despite 2 prior 'skipped's
    const r = await agent.deliver(obs({ id: 'o3', severity: 'high' }));
    expect(r[0].status).toBe('delivered');
  });
});

// ── Transport failure ─────────────────────────────────────────────

describe('OutputAgent.deliver — transport errors', () => {
  it("records 'failed' when transport returns ok=false (no auto-retry)", async () => {
    const failing: ChannelTransport = {
      async send() { return { ok: false, error: 'http 503', response_code: 503 }; },
    };
    agent.setTransport(failing);
    agent.addChannel({ tenant_id: TENANT, name: 'web', kind: 'webhook' });
    const records = await agent.deliver(obs());
    expect(records[0].status).toBe('failed');
    expect(records[0].error_message).toBe('http 503');
    expect(records[0].response_code).toBe(503);
  });

  it('catches transport exceptions and records as failed', async () => {
    const throwing: ChannelTransport = {
      async send() { throw new Error('connection refused'); },
    };
    agent.setTransport(throwing);
    agent.addChannel({ tenant_id: TENANT, name: 'web', kind: 'webhook' });
    const records = await agent.deliver(obs());
    expect(records[0].status).toBe('failed');
    expect(records[0].error_message).toBe('connection refused');
  });
});

// ── Audit reads ───────────────────────────────────────────────────

describe('OutputAgent — audit reads', () => {
  it('deliveriesForObservation filters correctly', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'slack', kind: 'slack' });
    await agent.deliver(obs({ id: 'o1' }));
    await agent.deliver(obs({ id: 'o2' }));
    expect(agent.deliveriesForObservation('o1')).toHaveLength(1);
    expect(agent.deliveriesForObservation('o2')).toHaveLength(1);
    expect(agent.deliveriesForObservation('o3')).toHaveLength(0);
  });

  it('recentDeliveries sorts newest first', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'slack', kind: 'slack' });
    await agent.deliver(obs({ id: 'o1' }));
    await new Promise(resolve => setTimeout(resolve, 5));
    await agent.deliver(obs({ id: 'o2' }));
    const recent = agent.recentDeliveries(TENANT);
    expect(recent[0].observation_id).toBe('o2');
    expect(recent[1].observation_id).toBe('o1');
  });
});

// ── Persist hook ──────────────────────────────────────────────────

describe('OutputAgent persist hook', () => {
  it('fires saveChannel + saveDelivery', async () => {
    let saves = { ch: 0, dlv: 0 };
    agent.setPersistHook({
      saveChannel:  () => { saves.ch++; },
      saveDelivery: () => { saves.dlv++; },
    });
    agent.addChannel({ tenant_id: TENANT, name: 'x', kind: 'slack' });
    await agent.deliver(obs());
    expect(saves.ch).toBe(1);
    expect(saves.dlv).toBe(1);
  });
});

// ── Hard safety: no source observation mutation ──────────────────

describe('OutputAgent — never mutates source observation', () => {
  it('observation object is unchanged after deliver()', async () => {
    agent.addChannel({ tenant_id: TENANT, name: 'slack', kind: 'slack' });
    const o = obs({ id: 'untouchable' });
    const snapshot = JSON.parse(JSON.stringify(o));
    await agent.deliver(o);
    expect(o).toEqual(snapshot);
  });
});
