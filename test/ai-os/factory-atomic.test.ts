import { describe, expect, it } from 'vitest';
import {
  newFactoryMockJob, transitionFactoryMock,
  type FactoryCommand, type FactoryJob, type FactoryMockContext,
} from '../../packages/ai-os-core/src/factory-contract.ts';
import {
  applyFactoryMockAtomically, type FactoryAtomicCommit, type FactoryAtomicStore,
} from '../../packages/ai-os-core/src/factory-atomic.ts';
import {
  newFactoryMockLeaseSnapshot, reduceFactoryMockLease,
} from '../../packages/ai-os-core/src/factory-lease.ts';

const now = '2026-11-20T10:00:00.000Z';
const hash = 'a'.repeat(64);
const context = (over: Partial<FactoryMockContext> = {}): FactoryMockContext => ({
  mode: 'simulation', operatorId: 'operator_mock', isOperator: true,
  aal2: true, scopeId: 'internal_A', now, ...over,
});
const command = (j: FactoryJob, operation: string, over: Partial<FactoryCommand> = {}): FactoryCommand => ({
  operation, expectedVersion: j.version, idempotencyKey: `request_${j.version}_${operation}`,
  evidenceRef: `ev_sf002_${j.version}_${operation}`, ...over,
});
const step = (j: FactoryJob, operation: string, ctx: FactoryMockContext = context(), over: Partial<FactoryCommand> = {}): FactoryJob => {
  const r = transitionFactoryMock(j, command(j, operation, over), ctx);
  if (!r.ok) throw new Error(`mock setup failed: ${r.reason}`);
  return r.job;
};
const initial = () => newFactoryMockJob('sf002', 'internal_A', 100);
const specified = () => step(initial(), 'specify', context(), { specSha256: hash });
const approved = () => step(specified(), 'approve_sandbox', context({ sandboxApproval: {
  id: 'human_approval_mock', jobId: 'sf002', specSha256: hash,
  approverId: 'human_operator', humanConfirmed: true, expiresAt: '2026-11-20T11:00:00Z',
}}));

/** Shared-memory TEST FIXTURE, NOT durable storage and NOT a production adapter. */
class FixtureAtomicStore implements FactoryAtomicStore {
  private readonly rows: Map<string, FactoryJob>;
  throwLoad = false;
  failCommit: 'before' | 'after' | null = null;
  reads = 0;
  constructor(rows: Map<string, FactoryJob> = new Map()) {
    this.rows = rows;
  }
  key(scope: string, id: string) { return `${scope}:${id}`; }
  seed(job: FactoryJob) { this.rows.set(this.key(job.scopeId, job.id), structuredClone(job)); }
  async load(scope: string, id: string): Promise<FactoryJob | null> {
    this.reads += 1;
    if (this.throwLoad) throw new Error('mock storage unavailable');
    return structuredClone(this.rows.get(this.key(scope, id)) ?? null);
  }
  async commit(input: FactoryAtomicCommit): Promise<'committed' | 'conflict' | 'missing'> {
    if (this.failCommit === 'before') throw new Error('mock write failed before commit');
    const key = this.key(input.scopeId, input.jobId);
    const existing = this.rows.get(key);
    if (!existing) return 'missing';
    if (existing.version !== input.expectedVersion) return 'conflict';
    // Simulate single atomic update for job, event and receipt, with a CAS guard.
    this.rows.set(key, structuredClone(input.next));
    if (this.failCommit === 'after') throw new Error('mock response lost after commit');
    return 'committed';
  }
}

describe('SF-002 simulated atomic store port', () => {
  it('stores exactly one state change with event and receipt', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const original = await store.load('internal_A', 'sf002');
    expect(original).not.toBeNull();
    const out = await applyFactoryMockAtomically(store, 'sf002',
      command(original!, 'specify', { specSha256: hash }), context());
    expect(out).toMatchObject({ ok: true, replay: false });
    const saved = await store.load('internal_A', 'sf002');
    expect(saved).toMatchObject({ version: 1, state: 'specified', specSha256: hash });
    expect(saved!.events).toHaveLength(1);
    expect(saved!.receipts).toHaveLength(1);
  });

  it('deduplicates after process restart with shared test fixture backing', async () => {
    const backing = new Map<string, FactoryJob>();
    const firstProcess = new FixtureAtomicStore(backing); firstProcess.seed(initial());
    const cmd = command(initial(), 'specify', { specSha256: hash });
    expect((await applyFactoryMockAtomically(firstProcess, 'sf002', cmd, context())).ok).toBe(true);
    const reinitialized = new FixtureAtomicStore(backing);
    expect(await applyFactoryMockAtomically(reinitialized, 'sf002', cmd, context()))
      .toMatchObject({ ok: true, replay: true });
    expect((await reinitialized.load('internal_A', 'sf002'))!.events).toHaveLength(1);
  });

  it('handles ambiguous response after commit without asserting false success', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const cmd = command(initial(), 'specify', { specSha256: hash });
    store.failCommit = 'after';
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context()))
      .toMatchObject({ ok: false, reason: 'store_unavailable' });
    store.failCommit = null;
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context()))
      .toMatchObject({ ok: true, replay: true });
    expect((await store.load('internal_A', 'sf002'))!.events).toHaveLength(1);
  });

  it('keeps state unchanged when commit fails before write', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial()); store.failCommit = 'before';
    expect(await applyFactoryMockAtomically(store, 'sf002',
      command(initial(), 'specify', { specSha256: hash }), context()))
      .toMatchObject({ ok: false, reason: 'store_unavailable' });
    expect((await store.load('internal_A', 'sf002'))!.version).toBe(0);
  });

  it('allows only one winner for racing writes with the same expected version', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const j = initial();
    const [a, b] = await Promise.all([
      applyFactoryMockAtomically(store, 'sf002', command(j, 'specify', {
        idempotencyKey: 'writer_a', specSha256: hash,
      }), context()),
      applyFactoryMockAtomically(store, 'sf002', command(j, 'specify', {
        idempotencyKey: 'writer_b', specSha256: 'b'.repeat(64),
      }), context()),
    ]);
    const successes = [a, b].filter(x => x.ok);
    expect(successes).toHaveLength(1);
    expect([a, b].some(x => !x.ok && x.reason === 'write_conflict')).toBe(true);
    expect((await store.load('internal_A', 'sf002'))!.events).toHaveLength(1);
  });

  it('rejects modified payload under reused idempotency key', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const cmd = command(initial(), 'specify', { specSha256: hash });
    await applyFactoryMockAtomically(store, 'sf002', cmd, context());
    expect(await applyFactoryMockAtomically(store, 'sf002',
      { ...cmd, specSha256: 'b'.repeat(64) }, context()))
      .toMatchObject({ ok: false, reason: 'idempotency_conflict' });
  });

  it('refuses database unavailability and never falls back to memory', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial()); store.throwLoad = true;
    expect(await applyFactoryMockAtomically(store, 'sf002',
      command(initial(), 'specify', { specSha256: hash }), context()))
      .toMatchObject({ ok: false, reason: 'store_unavailable' });
  });

  it('rejects missing or foreign workspace and corrupted snapshot', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const cmd = command(initial(), 'specify', { specSha256: hash });
    expect(await applyFactoryMockAtomically(store, 'missing', cmd, context()))
      .toMatchObject({ ok: false, reason: 'not_found' });
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context({ scopeId: 'foreign' })))
      .toMatchObject({ ok: false, reason: 'not_found' });
    store.seed({ ...initial(), version: 3 });
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context()))
      .toMatchObject({ ok: false, reason: 'integrity_error' });
  });

  it('refuses client-declared production and unauthorized identity before store access', async () => {
    const store = new FixtureAtomicStore(); store.seed(initial());
    const cmd = command(initial(), 'specify', { specSha256: hash });
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context({ mode: 'production' })))
      .toMatchObject({ ok: false, reason: 'simulation_only' });
    expect(await applyFactoryMockAtomically(store, 'sf002', cmd, context({ isOperator: false })))
      .toMatchObject({ ok: false, reason: 'not_operator' });
    expect(store.reads).toBe(0);
  });
});

describe('SF-002 simulated worker lease and fencing', () => {
  it('allocates epoch 1, locks out competing holders and extends only with the correct fence', () => {
    const j = approved(); const snapshot = newFactoryMockLeaseSnapshot(j);
    const got = reduceFactoryMockLease(snapshot, j, {
      operation: 'acquire', holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 30,
    }, context());
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.next.active?.epoch).toBe(1);
    expect(reduceFactoryMockLease(got.next, j, {
      operation: 'acquire', holderId: 'worker_b', expectedRevision: 1, ttlSeconds: 30,
    }, context())).toMatchObject({ ok: false, reason: 'leased_by_other' });
    const running = step(j, 'start_mock');
    const renewed = reduceFactoryMockLease(got.next, running, {
      operation: 'renew', holderId: 'worker_a', epoch: 1, expectedRevision: 1, ttlSeconds: 30,
    }, context({ now: '2026-11-20T10:00:10Z' }));
    expect(renewed).toMatchObject({ ok: true, next: { revision: 2, lastEpoch: 1 } });
  });

  it('fences stale worker after expiry and reacquisition', () => {
    const j = approved();
    const first = reduceFactoryMockLease(newFactoryMockLeaseSnapshot(j), j, {
      operation: 'acquire', holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 5,
    }, context());
    if (!first.ok) throw new Error('setup');
    const second = reduceFactoryMockLease(first.next, j, {
      operation: 'acquire', holderId: 'worker_b', expectedRevision: 1, ttlSeconds: 5,
    }, context({ now: '2026-11-20T10:00:06Z' }));
    expect(second).toMatchObject({ ok: true, next: { lastEpoch: 2 } });
    if (!second.ok) return;
    expect(reduceFactoryMockLease(second.next, step(j, 'start_mock'), {
      operation: 'renew', holderId: 'worker_a', epoch: 1, expectedRevision: 2, ttlSeconds: 5,
    }, context({ now: '2026-11-20T10:00:06Z' })))
      .toMatchObject({ ok: false, reason: 'stale_fence' });
  });

  it('rejects stale revision, wrong holder, expired renew and future terminal jobs', () => {
    const j = approved();
    const first = reduceFactoryMockLease(newFactoryMockLeaseSnapshot(j), j, {
      operation: 'acquire', holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 1,
    }, context());
    if (!first.ok) throw new Error('setup');
    expect(reduceFactoryMockLease(first.next, j, {
      operation: 'release', holderId: 'worker_a', epoch: 1, expectedRevision: 0,
    }, context())).toMatchObject({ ok: false, reason: 'revision_conflict' });
    expect(reduceFactoryMockLease(first.next, j, {
      operation: 'release', holderId: 'worker_b', epoch: 1, expectedRevision: 1,
    }, context())).toMatchObject({ ok: false, reason: 'stale_fence' });
    expect(reduceFactoryMockLease(first.next, step(j, 'start_mock'), {
      operation: 'renew', holderId: 'worker_a', epoch: 1, expectedRevision: 1, ttlSeconds: 1,
    }, context({ now: '2026-11-20T10:00:01Z' }))).toMatchObject({ ok: false, reason: 'lease_expired' });
    expect(reduceFactoryMockLease(newFactoryMockLeaseSnapshot(initial()), initial(), {
      operation: 'acquire', holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 1,
    }, context())).toMatchObject({ ok: false, reason: 'invalid_job' });
  });

  it('release retains epoch; reacquisition increments epoch', () => {
    const j = approved();
    const first = reduceFactoryMockLease(newFactoryMockLeaseSnapshot(j), j, {
      operation: 'acquire', holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 30,
    }, context());
    if (!first.ok) throw new Error('setup');
    const release = reduceFactoryMockLease(first.next, j, {
      operation: 'release', holderId: 'worker_a', epoch: 1, expectedRevision: 1,
    }, context());
    expect(release).toMatchObject({ ok: true, next: { lastEpoch: 1, active: null } });
    if (!release.ok) return;
    expect(reduceFactoryMockLease(release.next, j, {
      operation: 'acquire', holderId: 'worker_b', expectedRevision: 2, ttlSeconds: 30,
    }, context())).toMatchObject({ ok: true, next: { lastEpoch: 2 } });
  });

  it('rejects production and out-of-bounds lease duration', () => {
    const j = approved(); const snapshot = newFactoryMockLeaseSnapshot(j);
    const cmd = { operation: 'acquire' as const, holderId: 'worker_a', expectedRevision: 0, ttlSeconds: 999 };
    expect(reduceFactoryMockLease(snapshot, j, cmd, context()))
      .toMatchObject({ ok: false, reason: 'bad_input' });
    expect(reduceFactoryMockLease(snapshot, j, { ...cmd, ttlSeconds: 10 },
      context({ mode: 'production' }))).toMatchObject({ ok: false, reason: 'simulation_only' });
  });
});
