import { describe, expect, it, beforeEach } from 'vitest';
import {
  Executor,
  HandlerRegistry,
  InMemoryEventBus,
  SkillRegistry,
  type ApprovalGateRecord,
  type ApprovalGateService,
  type DecideGateInput,
  type ExecutionRecord,
  type ExecutionTracer,
  type OpenGateInput,
  type PermissionChecker,
  type RuntimeEvent,
} from '../../../../src/core/runtime';
import { registerSkillBindings, runtimeSkillId } from '../../../../src/core/runtime/bindings';

class FakeTracer implements ExecutionTracer {
  readonly rows = new Map<string, ExecutionRecord>();
  async start(record: ExecutionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }
  async finish(id: string, patch: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'status'>) {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`finish before start: ${id}`);
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
  async get(id: string): Promise<ApprovalGateRecord | undefined> { return this.rows.get(id); }
  async decide(input: DecideGateInput): Promise<ApprovalGateRecord> {
    const row = this.rows.get(input.id);
    if (!row) throw new Error('not found');
    const next = { ...row, status: input.status, decided_at: new Date().toISOString() };
    this.rows.set(input.id, next);
    return next;
  }
}

function permitAll(): PermissionChecker {
  return { async check() { return { outcome: 'granted' as const }; } };
}

function makeRuntime() {
  const registry = new SkillRegistry();
  const handlers = new HandlerRegistry();
  const tracer = new FakeTracer();
  const gates = new FakeGates();
  const events = new InMemoryEventBus();
  const seen: RuntimeEvent[] = [];
  for (const name of [
    'execution.started', 'execution.completed', 'execution.failed',
    'approval.requested', 'permission.denied',
  ] as const) {
    events.subscribe(name, (e) => { seen.push(e); });
  }
  const bindings = registerSkillBindings({ registry, handlers });
  const executor = new Executor({
    registry, handlers, tracer, gates, events, permissions: permitAll(),
  });
  return { registry, handlers, tracer, gates, events, executor, bindings, seen };
}

const baseInput = (skill_id: string, args: Record<string, unknown>) => ({
  tenant_id: 't1',
  agent_id: 'agent-1',
  skill_id,
  args,
});

describe('skill bindings end-to-end', () => {
  let rt: ReturnType<typeof makeRuntime>;
  beforeEach(() => { rt = makeRuntime(); });

  it('registers all 7 skills under skills.<snake_case> ids', () => {
    expect(rt.bindings.length).toBe(7);
    const ids = rt.registry.list().map((m) => m.id).sort();
    expect(ids).toContain('skills.marketing_performance_analytics');
    expect(ids).toContain('skills.data_exploration');
    expect(ids).toContain('skills.sales_draft_outreach');
  });

  it('executes a low-risk skill (marketing.calculate_conversion_rate) inline', async () => {
    const outcome = await rt.executor.execute(baseInput(
      runtimeSkillId('marketing-performance-analytics'),
      { action: 'calculate_conversion_rate', numerator: 50, denominator: 1000 },
    ));
    expect(outcome.status).toBe('completed');
    if (outcome.status !== 'completed') return;
    expect(outcome.output).toBe(5);
    expect(rt.seen.some((e) => e.name === 'execution.completed')).toBe(true);
    expect(rt.gates.opened).toHaveLength(0);
  });

  it('opens an approval gate for high-risk skills (sales-draft-outreach)', async () => {
    const outcome = await rt.executor.execute(baseInput(
      runtimeSkillId('sales-draft-outreach'),
      { action: 'build_outreach_research_plan', target: { company: 'Acme' } },
    ));
    expect(outcome.status).toBe('awaiting_approval');
    expect(rt.gates.opened).toHaveLength(1);
    expect(rt.gates.opened[0]?.risk_level).toBe('high');
    expect(rt.seen.some((e) => e.name === 'approval.requested')).toBe(true);
  });

  it('opens an approval gate for reviewRequired skills (finance-audit-support)', async () => {
    const outcome = await rt.executor.execute(baseInput(
      runtimeSkillId('finance-audit-support'),
      { action: 'recommend_sample_size', control_frequency: 'monthly', risk_level: 'high' },
    ));
    expect(outcome.status).toBe('awaiting_approval');
    expect(rt.gates.opened[0]?.risk_level).toBe('high');
  });

  it('completed execution emits a hashed output without raw payload in events', async () => {
    await rt.executor.execute(baseInput(
      runtimeSkillId('marketing-performance-analytics'),
      { action: 'calculate_ctr', clicks: 50, impressions: 5000 },
    ));
    const completed = rt.seen.find((e) => e.name === 'execution.completed');
    expect(completed).toBeDefined();
    expect((completed!.payload as { output_hash?: string }).output_hash).toBeTypeOf('string');
    // never leak raw output into the event payload
    expect(JSON.stringify(completed!.payload)).not.toMatch(/50000|0\.01/);
  });

  it('routes handler errors to status:failed with handler_threw', async () => {
    const outcome = await rt.executor.execute(baseInput(
      runtimeSkillId('marketing-performance-analytics'),
      { action: 'calculate_ctr', clicks: 50 /* impressions missing */ },
    ));
    expect(outcome.status).toBe('failed');
    if (outcome.status !== 'failed') return;
    expect(outcome.error_code).toBe('handler_threw');
  });

  it('rejects unknown actions inside an existing skill', async () => {
    const outcome = await rt.executor.execute(baseInput(
      runtimeSkillId('marketing-performance-analytics'),
      { action: 'nonexistent_action' },
    ));
    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') expect(outcome.error_code).toBe('handler_threw');
  });

  it('refuses to register the same bindings twice (loud fail on boot)', () => {
    expect(() => registerSkillBindings({ registry: rt.registry, handlers: rt.handlers }))
      .toThrow(/already registered/i);
  });
});
