import { describe, expect, it } from 'vitest';
import {
  BROWSER_MONITORING_MANIFEST,
  BROWSER_MONITORING_SKILL_ID,
  SEVERITY_ORDER,
  buildInspectionResult,
  classifyConsoleErrors,
  classifyNetworkFailures,
  classifyUiChecks,
  registerBrowserMonitoringSkill,
  requiresEscalation,
} from '../../../../src/core/runtime/skills/browser-monitoring';
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
} from '../../../../src/core/runtime';

describe('classifyConsoleErrors', () => {
  it('classifies an uncaught runtime error as critical', () => {
    const [f] = classifyConsoleErrors([{ message: 'Uncaught TypeError: x is not a function' }]);
    expect(f.severity).toBe('critical');
  });

  it('classifies a CSP violation as high', () => {
    const [f] = classifyConsoleErrors([{ message: 'Refused to load script because it violates CSP' }]);
    expect(f.severity).toBe('high');
  });

  it('classifies a deprecation warning as low', () => {
    const [f] = classifyConsoleErrors([{ message: 'DeprecationWarning: foo is deprecated' }]);
    expect(f.severity).toBe('low');
  });

  it('defaults unknown messages to medium', () => {
    const [f] = classifyConsoleErrors([{ message: 'Something odd happened' }]);
    expect(f.severity).toBe('medium');
  });

  it('surfaces repeat counts in the summary', () => {
    const [f] = classifyConsoleErrors([{ message: 'Something odd happened', count: 4 }]);
    expect(f.summary).toContain('×4');
  });
});

describe('classifyNetworkFailures', () => {
  it('treats status 0 (blocked/timeout) as high', () => {
    expect(classifyNetworkFailures([{ url: 'https://x.test/a' }])[0].severity).toBe('high');
  });

  it('treats 5xx as critical', () => {
    expect(classifyNetworkFailures([{ url: 'https://x.test/a', status: 503 }])[0].severity).toBe('critical');
  });

  it('treats 404 as high', () => {
    expect(classifyNetworkFailures([{ url: 'https://x.test/a', status: 404 }])[0].severity).toBe('high');
  });

  it('treats other 4xx as medium', () => {
    expect(classifyNetworkFailures([{ url: 'https://x.test/a', status: 403 }])[0].severity).toBe('medium');
  });

  it('tolerates a malformed url without throwing', () => {
    expect(() => classifyNetworkFailures([{ url: 'not-a-url', status: 500 }])).not.toThrow();
  });
});

describe('classifyUiChecks', () => {
  const viewport = { width: 390, height: 844 };

  it('flags a missing element as high', () => {
    expect(classifyUiChecks([{ selector: '.cta', viewport, found: false, visible: false, inViewport: false }])[0].severity).toBe('high');
  });

  it('flags a hidden element as high', () => {
    expect(classifyUiChecks([{ selector: '.cta', viewport, found: true, visible: false, inViewport: false }])[0].severity).toBe('high');
  });

  it('flags an out-of-viewport element as medium', () => {
    expect(classifyUiChecks([{ selector: '.cta', viewport, found: true, visible: true, inViewport: false }])[0].severity).toBe('medium');
  });

  it('reports a healthy element as info', () => {
    expect(classifyUiChecks([{ selector: '.cta', viewport, found: true, visible: true, inViewport: true }])[0].severity).toBe('info');
  });
});

describe('buildInspectionResult', () => {
  it('takes the worst severity across findings', () => {
    const findings = [
      ...classifyConsoleErrors([{ message: 'some warning' }]), // info
      ...classifyNetworkFailures([{ url: 'https://x.test/a', status: 503 }]), // critical
    ];
    expect(buildInspectionResult('/pricing', findings).severity).toBe('critical');
  });

  it('caps bullet points at 10 and sorts worst-first', () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      classifyNetworkFailures([{ url: `https://x.test/${i}`, status: i % 2 === 0 ? 503 : 403 }])[0],
    );
    const result = buildInspectionResult('/pricing', findings);
    expect(result.bulletPoints.length).toBeLessThanOrEqual(10);
    expect(result.bulletPoints[0]).toContain('[critical]');
  });

  it('falls back to a clean-bill message when nothing is notable', () => {
    const findings = classifyUiChecks([{ selector: '.cta', viewport: { width: 1280, height: 800 }, found: true, visible: true, inViewport: true }]);
    const result = buildInspectionResult('/pricing', findings);
    expect(result.severity).toBe('info');
    expect(result.bulletPoints[0]).toMatch(/no findings/i);
  });
});

describe('requiresEscalation', () => {
  it('is false for medium/low/info-only findings', () => {
    const findings = classifyUiChecks([{ selector: '.cta', viewport: { width: 390, height: 844 }, found: true, visible: true, inViewport: false }]);
    expect(requiresEscalation(findings)).toBe(false);
  });

  it('is true when any finding is high or critical', () => {
    const findings = classifyNetworkFailures([{ url: 'https://x.test/a', status: 500 }]);
    expect(requiresEscalation(findings)).toBe(true);
  });
});

it('every severity classifyX can produce is part of SEVERITY_ORDER', () => {
  const all = [
    ...classifyConsoleErrors([{ message: 'Uncaught TypeError' }, { message: 'warning: x' }, { message: 'huh' }]),
    ...classifyNetworkFailures([{ url: 'https://x.test/a', status: 500 }, { url: 'https://x.test/b' }]),
    ...classifyUiChecks([{ selector: '.a', viewport: { width: 1, height: 1 }, found: false, visible: false, inViewport: false }]),
  ];
  for (const f of all) expect(SEVERITY_ORDER).toContain(f.severity);
});

// ---------------------------------------------------------------------------
// Integration: the skill runs through the real Executor exactly like any
// other runtime skill — same runtime_executions/runtime_events/
// runtime_approval_gates path, no bespoke plumbing. Fakes mirror
// test/core/runtime/executor.test.ts.
// ---------------------------------------------------------------------------

class FakeTracer implements ExecutionTracer {
  readonly rows = new Map<string, ExecutionRecord>();
  async start(record: ExecutionRecord): Promise<void> {
    this.rows.set(record.id, { ...record });
  }
  async finish(id: string, patch: Partial<ExecutionRecord> & Pick<ExecutionRecord, 'status'>): Promise<void> {
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
    return { ...row, status: input.status, decided_at: new Date().toISOString() };
  }
}

function allowAll(): PermissionChecker {
  return { async check() { return { outcome: 'granted' }; } };
}

describe('registerBrowserMonitoringSkill + Executor integration', () => {
  it('registers a valid manifest', () => {
    const registry = new SkillRegistry();
    const handlers = new HandlerRegistry();
    expect(() => registerBrowserMonitoringSkill(registry, handlers)).not.toThrow();
    expect(registry.get(BROWSER_MONITORING_SKILL_ID)).toEqual(BROWSER_MONITORING_MANIFEST);
  });

  it('runs unattended (auto_approve) and completes with a runtime_execution + events, no gate for the skill itself', async () => {
    const registry = new SkillRegistry();
    const handlers = new HandlerRegistry();
    registerBrowserMonitoringSkill(registry, handlers);

    const tracer = new FakeTracer();
    const gates = new FakeGates();
    const events = new InMemoryEventBus();
    const seen: string[] = [];
    events.subscribe('execution.completed', (e) => {
      seen.push(e.name);
    });

    const executor = new Executor({
      registry,
      handlers,
      permissions: allowAll(),
      tracer,
      events,
      gates,
    });

    const outcome = await executor.execute({
      tenant_id: 'tenant-1',
      agent_id: 'browser-agent-x07',
      skill_id: BROWSER_MONITORING_SKILL_ID,
      args: {
        route: '/pricing',
        consoleErrors: [{ message: 'Uncaught TypeError: x is not a function' }],
        networkFailures: [],
        uiChecks: [],
      },
    });

    expect(outcome.status).toBe('completed');
    expect(gates.opened).toHaveLength(0); // auto_approve — no gate for the crawl itself
    expect(seen).toEqual(['execution.completed']);
    expect(tracer.rows.get((outcome as { execution_id: string }).execution_id)?.status).toBe('completed');

    if (outcome.status === 'completed') {
      const result = outcome.output as { severity: string };
      expect(result.severity).toBe('critical');
    }
  });

  it('escalation is a separate, explicit gate keyed to the completed execution', async () => {
    const registry = new SkillRegistry();
    const handlers = new HandlerRegistry();
    registerBrowserMonitoringSkill(registry, handlers);

    const tracer = new FakeTracer();
    const gates = new FakeGates();
    const executor = new Executor({
      registry,
      handlers,
      permissions: allowAll(),
      tracer,
      events: new InMemoryEventBus(),
      gates,
    });

    const outcome = await executor.execute({
      tenant_id: 'tenant-1',
      agent_id: 'browser-agent-x07',
      skill_id: BROWSER_MONITORING_SKILL_ID,
      args: { route: '/pricing', networkFailures: [{ url: 'https://x.test/pricing', status: 500 }] },
    });
    expect(outcome.status).toBe('completed');
    if (outcome.status !== 'completed') return;

    const result = outcome.output as { severity: string; findings: unknown[] };
    expect(requiresEscalation(result.findings as never)).toBe(true);

    // This is exactly what scripts/agents/browser-agent-x07.ts does after a
    // completed, escalation-worthy execution — reuse the SAME
    // ApprovalGateService the Executor itself uses, no new mechanism.
    const gate = await gates.open({
      execution_id: outcome.execution_id,
      reason: `Browser Agent X07: ${result.severity} finding(s) on /pricing`,
      risk_level: 'critical',
      requested_action: 'browser_monitoring.escalate_finding',
    });

    expect(gate.execution_id).toBe(outcome.execution_id);
    expect(gate.status).toBe('pending');
    expect(gates.opened).toHaveLength(1);
  });
});
