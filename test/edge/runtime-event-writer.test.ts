/**
 * Tier-Discipline Vertragstests fuer den kernel-v1 RuntimeEvent writer
 * (RFC §P0.2, P0-impl-3).
 *
 * Was hier bewiesen wird:
 *   - event_tier ist Pflicht und whitelisted
 *   - retention_class ist Pflicht und whitelisted
 *   - T2/T3 darf nicht replayable=true sein (Hard-Regel)
 *   - subject_ref Anti-Leak: kein Klartext-Email/IP, nur HMAC-Hex64
 *   - spec_version wird beim Insert auf '0.2' gesetzt
 *   - name defaultet auf event_type (legacy NOT NULL)
 *   - cost_snapshot mapped auf DB-Spalte cost_snapshot_json
 *   - DB-Fehler wird sauber durchgereicht
 */
import { describe, it, expect } from 'vitest';
import {
  writeKernelV1Event,
  validateKernelV1Event,
  TierDisciplineError,
  __internals,
  type KernelV1Event,
  type AdminClient,
} from '../../supabase/functions/_shared/runtime-event-writer';

const BASE: KernelV1Event = {
  tenant_id:       'tenant-A',
  event_type:      'scan.completed',
  event_tier:      'T1',
  retention_class: '3y',
};

function makeMockAdmin(opts: { insertError?: string } = {}): {
  admin: AdminClient;
  inserts: Array<{ table: string; row: Record<string, unknown> }>;
} {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const admin: AdminClient = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return Promise.resolve(
            opts.insertError
              ? { error: { message: opts.insertError } }
              : { error: null },
          );
        },
      };
    },
  };
  return { admin, inserts };
}

// ──────────────────────────────────────────────────────────────────────
// validateKernelV1Event — pure validation
// ──────────────────────────────────────────────────────────────────────

describe('validateKernelV1Event — required fields', () => {
  it('throws when tenant_id is missing', () => {
    expect(() => validateKernelV1Event({ ...BASE, tenant_id: '' }))
      .toThrow(TierDisciplineError);
  });

  it('throws when event_type is missing', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_type: '' }))
      .toThrow(TierDisciplineError);
  });

  it('throws when event_tier is missing', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: undefined as unknown as 'T1' }))
      .toThrow(TierDisciplineError);
  });

  it('throws when event_tier is outside whitelist', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T4' as 'T1' }))
      .toThrow(/event_tier must be one of/);
  });

  it('throws when retention_class is missing', () => {
    expect(() => validateKernelV1Event({ ...BASE, retention_class: undefined as unknown as '3y' }))
      .toThrow(TierDisciplineError);
  });

  it('throws when retention_class is outside whitelist', () => {
    expect(() => validateKernelV1Event({ ...BASE, retention_class: '5y' as '3y' }))
      .toThrow(/retention_class must be one of/);
  });
});

describe('validateKernelV1Event — T2/T3 replayable hard rule', () => {
  it('rejects T2 with replayable=true', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T2', replayable: true }))
      .toThrow(/replayable=true is forbidden for tier T2/);
  });

  it('rejects T3 with replayable=true', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T3', replayable: true }))
      .toThrow(/replayable=true is forbidden for tier T3/);
  });

  it('allows T2 with replayable=false (and omitted)', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T2', replayable: false }))
      .not.toThrow();
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T2' })).not.toThrow();
  });

  it('allows T1 with replayable=true', () => {
    expect(() => validateKernelV1Event({ ...BASE, event_tier: 'T1', replayable: true }))
      .not.toThrow();
  });
});

describe('validateKernelV1Event — subject_ref anti-leak', () => {
  it('accepts a 64-char lowercase hex string (HMAC output)', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'a'.repeat(64) })).not.toThrow();
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'deadbeef' + '0'.repeat(56) }))
      .not.toThrow();
  });

  it('rejects empty subject_ref (use undefined instead)', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: '' }))
      .toThrow(/subject_ref must be omitted/);
  });

  it('rejects subject_ref that contains a plaintext email', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'user@example.com' }))
      .toThrow(/plaintext email/);
  });

  it('rejects subject_ref that contains a plaintext IPv4', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: '192.168.1.1' }))
      .toThrow(/plaintext IPv4/);
  });

  it('rejects non-hex strings of correct length', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'Z'.repeat(64) }))
      .toThrow(/64-character lowercase hex/);
  });

  it('rejects uppercase hex (consistency contract — helper emits lowercase)', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'A'.repeat(64) }))
      .toThrow(/64-character lowercase hex/);
  });

  it('rejects hex of wrong length', () => {
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'a'.repeat(63) }))
      .toThrow(/64-character lowercase hex/);
    expect(() => validateKernelV1Event({ ...BASE, subject_ref: 'a'.repeat(65) }))
      .toThrow(/64-character lowercase hex/);
  });
});

describe('validateKernelV1Event — TierDisciplineError carries code', () => {
  it('exposes error.code for telemetry', () => {
    try {
      validateKernelV1Event({ ...BASE, event_tier: 'T7' as 'T1' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TierDisciplineError);
      expect((e as TierDisciplineError).code).toBe('EVENT_TIER_INVALID');
    }
  });
});

// ──────────────────────────────────────────────────────────────────────
// writeKernelV1Event — DB insert shape
// ──────────────────────────────────────────────────────────────────────

describe('writeKernelV1Event — happy path', () => {
  it('inserts into runtime_events with spec_version=0.2', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, BASE);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe('runtime_events');
    expect(inserts[0].row).toMatchObject({
      tenant_id:       'tenant-A',
      event_type:      'scan.completed',
      event_tier:      'T1',
      retention_class: '3y',
      spec_version:    '0.2',
      replayable:      false,
    });
  });

  it('defaults name to event_type (legacy NOT NULL column)', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, BASE);
    expect(inserts[0].row.name).toBe('scan.completed');
  });

  it('respects explicit name override', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, { ...BASE, name: 'legacy.alias' });
    expect(inserts[0].row.name).toBe('legacy.alias');
  });

  it('defaults occurred_at to ISO timestamp', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, BASE);
    expect(inserts[0].row.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults replayable to false (safer than implicit true)', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, { ...BASE, event_tier: 'T0' });
    expect(inserts[0].row.replayable).toBe(false);
  });

  it('respects explicit replayable=true for T0/T1', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, { ...BASE, event_tier: 'T0', replayable: true });
    expect(inserts[0].row.replayable).toBe(true);
  });

  it('maps cost_snapshot to cost_snapshot_json column', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, {
      ...BASE,
      cost_snapshot: { total_usd: 0.042, model_ref: 'claude' },
    });
    expect(inserts[0].row.cost_snapshot_json).toEqual({ total_usd: 0.042, model_ref: 'claude' });
    expect(inserts[0].row.cost_snapshot).toBeUndefined();
  });

  it('passes through subject_ref, agent_ref, trace_id, correlation_id, causation_id, execution_id, agent_id, skill_id', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, {
      ...BASE,
      subject_ref:    'b'.repeat(64),
      agent_ref:      'ai-risk:v1:0.4',
      trace_id:       'trace-1',
      correlation_id: 'corr-1',
      causation_id:   42,
      execution_id:   'exec-1',
      agent_id:       'agent-1',
      skill_id:       'skill-1',
    });
    expect(inserts[0].row).toMatchObject({
      subject_ref:    'b'.repeat(64),
      agent_ref:      'ai-risk:v1:0.4',
      trace_id:       'trace-1',
      correlation_id: 'corr-1',
      causation_id:   42,
      execution_id:   'exec-1',
      agent_id:       'agent-1',
      skill_id:       'skill-1',
    });
  });

  it('omits envelope fields when undefined (no null-spam)', async () => {
    const { admin, inserts } = makeMockAdmin();
    await writeKernelV1Event(admin, BASE);
    const row = inserts[0].row;
    expect(row.subject_ref).toBeUndefined();
    expect(row.agent_ref).toBeUndefined();
    expect(row.trace_id).toBeUndefined();
    expect(row.correlation_id).toBeUndefined();
    expect(row.causation_id).toBeUndefined();
    expect(row.cost_snapshot_json).toBeUndefined();
  });
});

describe('writeKernelV1Event — failure paths', () => {
  it('does NOT call DB when validation fails', async () => {
    const { admin, inserts } = makeMockAdmin();
    await expect(
      writeKernelV1Event(admin, { ...BASE, event_tier: 'T2', replayable: true }),
    ).rejects.toThrow(TierDisciplineError);
    expect(inserts).toHaveLength(0);
  });

  it('throws on DB insert error', async () => {
    const { admin } = makeMockAdmin({ insertError: 'check constraint violated' });
    await expect(writeKernelV1Event(admin, BASE))
      .rejects.toThrow(/writeKernelV1Event insert failed: check constraint violated/);
  });
});

describe('__internals regex sanity', () => {
  it('EMAIL_RE matches common email shapes', () => {
    expect(__internals.EMAIL_RE.test('foo@bar.com')).toBe(true);
    expect(__internals.EMAIL_RE.test('a.b+c@d.co')).toBe(true);
    expect(__internals.EMAIL_RE.test('nope')).toBe(false);
  });
  it('IPV4_RE matches dotted-quad shapes', () => {
    expect(__internals.IPV4_RE.test('10.0.0.1')).toBe(true);
    expect(__internals.IPV4_RE.test('255.255.255.255')).toBe(true);
    expect(__internals.IPV4_RE.test('not.an.ip.address')).toBe(false);
  });
});
