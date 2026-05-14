import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Executor,
  HandlerRegistry,
  InMemoryEventBus,
  SkillRegistry,
  type ApprovalGateRecord,
  type ApprovalGateService,
  type DecideGateInput,
  type ExecutionInput,
  type ExecutionRecord,
  type ExecutionTracer,
  type OpenGateInput,
  type Capability,
  type PermissionChecker,
  type PermissionCheckInput,
  type PermissionDecision,
  type RuntimeEvent,
  type SkillManifest,
} from '../../../src/core/runtime';

// ---------------------------------------------------------------------------
// In-memory test doubles. These intentionally mirror the production
// contracts without any Supabase awareness — Phase 1.2 wires concrete
// Postgres-backed impls behind the same interfaces.
// ---------------------------------------------------------------------------

class FakeTracer implements ExecutionTracer {
  readonly rows = new Map<string, ExecutionRecord>();
  async start(record: ExecutionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }
  async finish(
    id: string,
    patch: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'status'>,
  ): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`finish() before start() for ${id}`);
    this.rows.set(id, { ...existing, ...patch });
  }
}

class FakeGates implements ApprovalGateService {
  readonly opened: OpenGateInput[] = [];
  readonly rows = new Map<string, ApprovalGateRecord>();
  #seq = 0;
  async open(input: OpenGateInput): Promise<ApprovalGateRecord> {
    this.opened.push(input);
    const id = `gate_${++this.#seq}`;
    const row: ApprovalGateRecord = {
      id,
      execution_id: input.execution_id,
      reason: input.reason,
      risk_level: input.risk_level,
      requested_action: input.requested_action,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.rows.set(id, row);
    return row;
  }
  async get(id: string): Promise<ApprovalGateRecord | undefined> {
    return this.rows.get(id);
  }
  async decide(input: DecideGateInput): Promise<ApprovalGateRecord> {
    const row = this.rows.get(input.id);
    if (!row) throw new Error(`gate ${input.id} not found`);
    if (row.status !== 'pending') {
      throw new Error(`gate ${input.id} already decided`);
    }
    const next: ApprovalGateRecord = {
      ...row,
      status: input.status,
      decided_at: new Date().toISOString(),
    };
    this.rows.set(input.id, next);
    return next;
  }
}

function permitAll(): PermissionChecker {
  return {
    async check(): Promise<PermissionDecision> {
      return { outcome: 'granted' };
    },
  };
}

function denyWith(missing: readonly Capability[]): PermissionChecker {
  return {
    async check(input: PermissionCheckInput): Promise<PermissionDecision> {
      return { outcome: 'denied', missing, reason: `missing for ${input.skill_id}` };
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const readOnlySkill: SkillManifest = {
  id: 'audit.cookie_scan',
  version: 1,
  title: 'Cookie scan',
  description: 'Scans a URL for cookies.',
  capabilities: ['read:tenant.audit', 'network:external'],
  risk_level: 'low',
  auto_approve: true,
  pii_class: 'none',
  idempotent: true,
};

const writingSkill: SkillManifest = {
  id: 'shopify.consent_inject',
  version: 1,
  title: 'Inject consent banner',
  description: 'Installs a consent banner.',
  capabilities: ['write:tenant.remediation', 'consent:write'],
  risk_level: 'medium',
  auto_approve: false,
  pii_class: 'none',
  idempotent: false,
};

function makeInput(overrides: Partial<ExecutionInput> = {}): ExecutionInput {
  return {
    tenant_id: 'tenant-1',
    agent_id: 'audit-agent',
    skill_id: 'audit.cookie_scan',
    args: { url: 'https://example.com' },
    ...overrides,
  };
}

function fixedClock(): () => Date {
  const t = new Date('2026-05-14T00:00:00.000Z');
  return () => t;
}

function sequentialIds(): () => string {
  let n = 0;
  return () => `exec_${++n}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let registry: SkillRegistry;
let handlers: HandlerRegistry;
let tracer: FakeTracer;
let events: InMemoryEventBus;
let gates: FakeGates;
let receivedEvents: RuntimeEvent[];

beforeEach(() => {
  registry = new SkillRegistry();
  registry.register(readOnlySkill);
  registry.register(writingSkill);

  handlers = new HandlerRegistry();
  tracer = new FakeTracer();
  events = new InMemoryEventBus();
  gates = new FakeGates();
  receivedEvents = [];

  for (const name of [
    'execution.started',
    'execution.completed',
    'execution.failed',
    'approval.requested',
    'permission.denied',
  ] as const) {
    events.subscribe(name, (e) => {
      receivedEvents.push(e);
    });
  }
});

describe('Executor — happy path', () => {
  it('runs an auto-approve skill end to end', async () => {
    handlers.register('audit.cookie_scan', async (ctx) => {
      expect(ctx.tenant_id).toBe('tenant-1');
      expect(ctx.args).toEqual({ url: 'https://example.com' });
      return { output_hash: 'deadbeef', output: { findings: 3 } };
    });

    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
      id: sequentialIds(),
      clock: fixedClock(),
    });

    const outcome = await executor.execute(makeInput());

    expect(outcome).toEqual({
      status: 'completed',
      execution_id: 'exec_1',
      output_hash: 'deadbeef',
      output: { findings: 3 },
    });

    const row = tracer.rows.get('exec_1')!;
    expect(row.status).toBe('completed');
    expect(row.input_hash).toMatch(/^[0-9a-f]{8}$/);
    expect(row.output_hash).toBe('deadbeef');
    expect(row.finished_at).toBe('2026-05-14T00:00:00.000Z');

    expect(receivedEvents.map((e) => e.name)).toEqual([
      'execution.started',
      'execution.completed',
    ]);
    expect(gates.opened).toEqual([]);
  });
});

describe('Executor — approval flow', () => {
  it('opens a gate and stops before the handler when auto_approve is false', async () => {
    const handler = vi.fn();
    handlers.register('shopify.consent_inject', handler);

    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
      id: sequentialIds(),
      clock: fixedClock(),
    });

    const outcome = await executor.execute(
      makeInput({ skill_id: 'shopify.consent_inject' }),
    );

    expect(outcome).toEqual({
      status: 'awaiting_approval',
      execution_id: 'exec_1',
      gate_id: 'gate_1',
    });
    expect(handler).not.toHaveBeenCalled();
    expect(tracer.rows.get('exec_1')?.status).toBe('awaiting_approval');
    expect(gates.opened).toHaveLength(1);
    expect(gates.opened[0]).toMatchObject({
      execution_id: 'exec_1',
      risk_level: 'medium',
      requested_action: 'shopify.consent_inject',
    });
    expect(receivedEvents.map((e) => e.name)).toEqual([
      'execution.started',
      'approval.requested',
    ]);
  });
});

describe('Executor — denials and errors', () => {
  it('records permission_denied in the audit trail and never runs the handler', async () => {
    const handler = vi.fn();
    handlers.register('audit.cookie_scan', handler);

    const executor = new Executor({
      registry,
      handlers,
      permissions: denyWith(['network:external']),
      tracer,
      events,
      gates,
      id: sequentialIds(),
      clock: fixedClock(),
    });

    const outcome = await executor.execute(makeInput());

    expect(outcome).toEqual({
      status: 'failed',
      execution_id: 'exec_1',
      error_code: 'permission_denied',
    });
    expect(handler).not.toHaveBeenCalled();
    expect(tracer.rows.get('exec_1')?.status).toBe('failed');
    expect(tracer.rows.get('exec_1')?.error_code).toBe('permission_denied');
    const denied = receivedEvents.find((e) => e.name === 'permission.denied');
    expect(denied?.payload).toMatchObject({ missing: ['network:external'] });
  });

  it('captures a thrown handler as failed/handler_threw', async () => {
    handlers.register('audit.cookie_scan', async () => {
      throw new Error('boom');
    });

    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
      id: sequentialIds(),
      clock: fixedClock(),
    });

    const outcome = await executor.execute(makeInput());

    expect(outcome).toMatchObject({ status: 'failed', error_code: 'handler_threw' });
    expect(tracer.rows.get('exec_1')?.status).toBe('failed');
    const failedEvent = receivedEvents.find((e) => e.name === 'execution.failed');
    expect(failedEvent?.payload).toMatchObject({ error: 'boom' });
  });

  it('returns skill_not_found without creating an execution row', async () => {
    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
    });

    const outcome = await executor.execute(makeInput({ skill_id: 'nope.gone' }));
    expect(outcome).toEqual({ status: 'failed', error_code: 'skill_not_found' });
    expect(tracer.rows.size).toBe(0);
    expect(receivedEvents).toEqual([]);
  });

  it('returns handler_not_found when registry has the skill but no handler', async () => {
    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
    });

    const outcome = await executor.execute(makeInput());
    expect(outcome).toEqual({ status: 'failed', error_code: 'handler_not_found' });
    expect(tracer.rows.size).toBe(0);
  });

  it('rejects invalid input shape before touching any dependency', async () => {
    const executor = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
    });

    const outcome = await executor.execute({
      tenant_id: '',
      agent_id: 'a',
      skill_id: 's',
      args: {},
    });
    expect(outcome).toEqual({ status: 'failed', error_code: 'invalid_input' });
    expect(tracer.rows.size).toBe(0);
  });
});

describe('Executor — input hashing', () => {
  it('produces stable hashes regardless of argument key order', async () => {
    handlers.register('audit.cookie_scan', async () => ({ output_hash: 'h' }));

    const e = new Executor({
      registry,
      handlers,
      permissions: permitAll(),
      tracer,
      events,
      gates,
      id: sequentialIds(),
      clock: fixedClock(),
    });

    await e.execute(makeInput({ args: { a: 1, b: { x: 1, y: 2 } } }));
    await e.execute(makeInput({ args: { b: { y: 2, x: 1 }, a: 1 } }));

    const [a, b] = [tracer.rows.get('exec_1')!, tracer.rows.get('exec_2')!];
    expect(a.input_hash).toBe(b.input_hash);
  });
});
