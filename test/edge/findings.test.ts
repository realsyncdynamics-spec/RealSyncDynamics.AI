/**
 * Adapter contract tests for supabase/functions/_shared/findings.
 *
 * Mocks the AdminLike client; no DB round-trips. The migration's
 * CHECK constraints are covered separately by CI's Migration
 * validation job + the local PG15 apply during development.
 */
import { describe, it, expect } from 'vitest';
import {
  recordFinding,
  updateFindingStatus,
  type AdminLike,
  type FindingRow,
} from '../../supabase/functions/_shared/findings';

interface InsertCall { table: string; row: Record<string, unknown> }
interface UpdateCall { table: string; patch: Record<string, unknown>; col: string; val: unknown }

function mockAdmin(opts: {
  insertResult?: { error: { message: string } | null };
  updateResult?: { error: { message: string } | null };
  selectRows?:   FindingRow[];
} = {}): {
  admin:       AdminLike;
  insertCalls: InsertCall[];
  updateCalls: UpdateCall[];
} {
  const insertCalls: InsertCall[] = [];
  const updateCalls: UpdateCall[] = [];
  const admin: AdminLike = {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          insertCalls.push({ table, row });
          return Promise.resolve({ data: null, error: opts.insertResult?.error ?? null });
        },
        select() {
          // listFindings path — return canned rows.
          // deno-lint-ignore no-explicit-any
          const chain: any = {
            eq()    { return chain; },
            order() { return chain; },
            limit() { return Promise.resolve({ data: opts.selectRows ?? [], error: null }); },
            then(resolve: (v: { data: unknown; error: null }) => void) {
              resolve({ data: opts.selectRows ?? [], error: null });
            },
          };
          return chain;
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              updateCalls.push({ table, patch, col, val });
              return Promise.resolve({ error: opts.updateResult?.error ?? null });
            },
          };
        },
      };
    },
  };
  return { admin, insertCalls, updateCalls };
}

describe('recordFinding', () => {
  it('persists a complete row with all optional fields populated', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id:      't-1',
      website_id:     'w-1',
      scan_run_id:    's-1',
      category:       'consent',
      severity:       'high',
      detector:       'gdpr-audit',
      evidence_ref:   'sha256:abc',
      summary:        'Tracker fires before consent',
      raw_payload:    { url: 'https://example.com', vendor: 'google' },
      correlation_id: 'corr-1',
    });
    expect(r.ok).toBe(true);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('findings');
    expect(insertCalls[0].row).toMatchObject({
      tenant_id:      't-1',
      website_id:     'w-1',
      scan_run_id:    's-1',
      category:       'consent',
      severity:       'high',
      status:         'open',     // default-populated
      detector:       'gdpr-audit',
      evidence_ref:   'sha256:abc',
      summary:        'Tracker fires before consent',
      correlation_id: 'corr-1',
    });
  });

  it('defaults status to "open" when not supplied', async () => {
    const { admin, insertCalls } = mockAdmin();
    await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      severity:  'medium',
      detector:  'cookie-scanner',
      summary:   'Unknown vendor',
    });
    expect(insertCalls[0].row.status).toBe('open');
  });

  it('null-pads all optional fields when omitted', async () => {
    const { admin, insertCalls } = mockAdmin();
    await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      severity:  'medium',
      detector:  'cookie-scanner',
      summary:   'Unknown vendor',
    });
    expect(insertCalls[0].row.website_id).toBeNull();
    expect(insertCalls[0].row.scan_run_id).toBeNull();
    expect(insertCalls[0].row.evidence_ref).toBeNull();
    expect(insertCalls[0].row.raw_payload).toBeNull();
    expect(insertCalls[0].row.correlation_id).toBeNull();
  });

  it('rejects missing tenant_id without hitting the DB', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id: '',
      category:  'tracker',
      severity:  'medium',
      detector:  'cookie-scanner',
      summary:   'x',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/tenant_id/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects invalid category before insert', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id: 't-1',
      // deno-lint-ignore no-explicit-any
      category:  'made_up' as any,
      severity:  'medium',
      detector:  'd',
      summary:   's',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid category/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects invalid severity before insert', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      // deno-lint-ignore no-explicit-any
      severity:  'devastating' as any,
      detector:  'd',
      summary:   's',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid severity/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects summary > 1000 chars before insert', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      severity:  'low',
      detector:  'd',
      summary:   'x'.repeat(1001),
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/summary too long/);
    expect(insertCalls).toHaveLength(0);
  });

  it('propagates DB error on insert failure', async () => {
    const { admin } = mockAdmin({ insertResult: { error: { message: 'unique-violation' } } });
    const r = await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      severity:  'low',
      detector:  'd',
      summary:   's',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('unique-violation');
  });

  // ─── Evidence-First fields (PR feat(findings): confidence + evidence) ──

  it('passes confidence_score / evidence_level / verification_status when supplied', async () => {
    const { admin, insertCalls } = mockAdmin();
    await recordFinding(admin, {
      tenant_id: 't-1',
      category:  'tracker',
      severity:  'high',
      detector:  'gdpr-audit',
      summary:   'Tracker observed',
      confidence_score:    0.72,
      evidence_level:      'observed',
      verification_status: 'partial',
    });
    expect(insertCalls[0].row.confidence_score).toBe(0.72);
    expect(insertCalls[0].row.evidence_level).toBe('observed');
    expect(insertCalls[0].row.verification_status).toBe('partial');
  });

  it('lets DB defaults fire when evidence fields are omitted', async () => {
    const { admin, insertCalls } = mockAdmin();
    await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's',
    });
    expect(insertCalls[0].row.confidence_score).toBeUndefined();
    expect(insertCalls[0].row.evidence_level).toBeUndefined();
    expect(insertCalls[0].row.verification_status).toBeUndefined();
  });

  it('rejects confidence_score outside 0..1', async () => {
    const { admin, insertCalls } = mockAdmin();
    const r = await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's', confidence_score: 1.5,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/confidence_score/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects unknown evidence_level', async () => {
    const { admin, insertCalls } = mockAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's',
      evidence_level: 'wild_guess' as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/evidence_level/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects unknown verification_status', async () => {
    const { admin, insertCalls } = mockAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's',
      verification_status: 'maybe-ish' as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/verification_status/);
    expect(insertCalls).toHaveLength(0);
  });

  it('rejects NaN / Infinity confidence_score', async () => {
    const { admin } = mockAdmin();
    expect((await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's', confidence_score: NaN,
    })).ok).toBe(false);
    expect((await recordFinding(admin, {
      tenant_id: 't-1', category: 'tracker', severity: 'low',
      detector: 'd', summary: 's', confidence_score: Infinity,
    })).ok).toBe(false);
  });
});

describe('updateFindingStatus', () => {
  it('updates the status column for the matching id', async () => {
    const { admin, updateCalls } = mockAdmin();
    const r = await updateFindingStatus(admin, 'f-1', 'acknowledged');
    expect(r.ok).toBe(true);
    expect(updateCalls).toEqual([
      { table: 'findings', patch: { status: 'acknowledged' }, col: 'id', val: 'f-1' },
    ]);
  });

  it('rejects empty findingId', async () => {
    const { admin, updateCalls } = mockAdmin();
    const r = await updateFindingStatus(admin, '', 'acknowledged');
    expect(r.ok).toBe(false);
    expect(updateCalls).toHaveLength(0);
  });

  it('rejects invalid next status', async () => {
    const { admin, updateCalls } = mockAdmin();
    // deno-lint-ignore no-explicit-any
    const r = await updateFindingStatus(admin, 'f-1', 'banana' as any);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid status/);
    expect(updateCalls).toHaveLength(0);
  });

  it('propagates DB error from update', async () => {
    const { admin } = mockAdmin({ updateResult: { error: { message: 'rls-blocked' } } });
    const r = await updateFindingStatus(admin, 'f-1', 'resolved');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('rls-blocked');
  });
});
