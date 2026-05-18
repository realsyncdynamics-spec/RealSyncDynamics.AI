import { describe, it, expect, beforeEach } from 'vitest';
import {
  CapabilityPermissionChecker,
  Executor,
  HandlerRegistry,
  InMemoryAgentResolver,
  InMemoryEventBus,
  SkillRegistry,
  type AgentCapabilityResolver,
  type ExecutionTracer,
  type ExecutionRecord,
  type ApprovalGateService,
  type SkillManifest,
} from '../../../src/core/runtime';

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

// Minimal stub used only by the executor end-to-end test below.
class NullTracer implements ExecutionTracer {
  readonly rows: ExecutionRecord[] = [];
  async start(r: ExecutionRecord) { this.rows.push({ ...r }); }
  async finish() {}
}
const nullGates: ApprovalGateService = {
  async open() { throw new Error('not used'); },
  async get() { return undefined; },
  async decide() { throw new Error('not used'); },
};

// ---------------------------------------------------------------------------
// CapabilityPermissionChecker
// ---------------------------------------------------------------------------

describe('CapabilityPermissionChecker.check', () => {
  let resolver: InMemoryAgentResolver;

  beforeEach(() => {
    resolver = new InMemoryAgentResolver();
  });

  it('grants when the agent has every required capability', async () => {
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: ['read:tenant.audit', 'network:external'],
    });
    const checker = new CapabilityPermissionChecker(resolver);

    const decision = await checker.check({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      required: readOnlySkill.capabilities,
    });

    expect(decision).toEqual({ outcome: 'granted' });
  });

  it('denies with the missing capabilities listed', async () => {
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: ['read:tenant.audit'],
    });
    const checker = new CapabilityPermissionChecker(resolver);

    const decision = await checker.check({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      required: readOnlySkill.capabilities,
    });

    expect(decision.outcome).toBe('denied');
    if (decision.outcome === 'denied') {
      expect(decision.missing).toEqual(['network:external']);
      expect(decision.reason).toMatch(/missing_capabilities/);
    }
  });

  it('denies an unknown agent and lists all required as missing', async () => {
    const checker = new CapabilityPermissionChecker(resolver);

    const decision = await checker.check({
      tenant_id: 'tenant-1',
      agent_id: 'ghost',
      skill_id: 'audit.cookie_scan',
      required: readOnlySkill.capabilities,
    });

    expect(decision.outcome).toBe('denied');
    if (decision.outcome === 'denied') {
      expect(decision.missing).toEqual(readOnlySkill.capabilities);
      expect(decision.reason).toMatch(/agent_not_found/);
    }
  });

  it('rejects cross-tenant smuggling even if a resolver returns a foreign agent', async () => {
    // Bypass the in-memory resolver's tenant key by writing a stub that
    // hands back an agent from tenant A when asked about tenant B.
    const smugglingResolver: AgentCapabilityResolver = {
      async resolve() {
        return {
          agent_id: 'cross-agent',
          tenant_id: 'tenant-A',
          granted_capabilities: ['read:tenant.audit', 'network:external'],
        };
      },
    };
    const checker = new CapabilityPermissionChecker(smugglingResolver);

    const decision = await checker.check({
      tenant_id: 'tenant-B',
      agent_id: 'cross-agent',
      skill_id: 'audit.cookie_scan',
      required: readOnlySkill.capabilities,
    });

    expect(decision.outcome).toBe('denied');
    if (decision.outcome === 'denied') {
      expect(decision.reason).toMatch(/agent_tenant_mismatch/);
    }
  });

  it('grants vacuously when the skill requires no capabilities', async () => {
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: [],
    });
    const checker = new CapabilityPermissionChecker(resolver);

    const decision = await checker.check({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'noop',
      required: [],
    });

    expect(decision).toEqual({ outcome: 'granted' });
  });

  it('preserves the order of the missing capabilities for stable audit logs', async () => {
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: [],
    });
    const checker = new CapabilityPermissionChecker(resolver);

    const decision = await checker.check({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      required: ['network:external', 'read:tenant.audit'],
    });

    expect(decision.outcome).toBe('denied');
    if (decision.outcome === 'denied') {
      expect(decision.missing).toEqual(['network:external', 'read:tenant.audit']);
    }
  });
});

// ---------------------------------------------------------------------------
// InMemoryAgentResolver
// ---------------------------------------------------------------------------

describe('InMemoryAgentResolver', () => {
  it('returns a registered agent', async () => {
    const r = new InMemoryAgentResolver();
    r.register({
      agent_id: 'a1',
      tenant_id: 't1',
      granted_capabilities: ['read:tenant.audit'],
    });
    const agent = await r.resolve({ tenant_id: 't1', agent_id: 'a1' });
    expect(agent?.agent_id).toBe('a1');
  });

  it('returns undefined for the same agent_id under a different tenant', async () => {
    const r = new InMemoryAgentResolver();
    r.register({
      agent_id: 'shared',
      tenant_id: 't1',
      granted_capabilities: [],
    });
    const agent = await r.resolve({ tenant_id: 't2', agent_id: 'shared' });
    expect(agent).toBeUndefined();
  });

  it('rejects double registration of the same (tenant, agent) pair', () => {
    const r = new InMemoryAgentResolver();
    const def = {
      agent_id: 'a1',
      tenant_id: 't1',
      granted_capabilities: [] as const,
    };
    r.register(def);
    expect(() => r.register(def)).toThrow(/already registered/);
  });

  it('returns a defensive copy so callers cannot mutate the store', async () => {
    const r = new InMemoryAgentResolver();
    const grants: Array<'read:tenant.audit'> = ['read:tenant.audit'];
    r.register({ agent_id: 'a', tenant_id: 't', granted_capabilities: grants });
    grants.push('read:tenant.audit'); // mutate the input array

    const agent = await r.resolve({ tenant_id: 't', agent_id: 'a' });
    expect(agent?.granted_capabilities).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: Executor + real PermissionChecker
// ---------------------------------------------------------------------------

describe('Executor wired to CapabilityPermissionChecker', () => {
  it('runs the handler when the agent has the required capabilities', async () => {
    const skills = new SkillRegistry();
    skills.register(readOnlySkill);
    const handlers = new HandlerRegistry();
    handlers.register('audit.cookie_scan', async () => ({ output_hash: 'ok' }));
    const resolver = new InMemoryAgentResolver();
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: ['read:tenant.audit', 'network:external'],
    });
    const exec = new Executor({
      registry: skills,
      handlers,
      permissions: new CapabilityPermissionChecker(resolver),
      tracer: new NullTracer(),
      events: new InMemoryEventBus(),
      gates: nullGates,
    });

    const outcome = await exec.execute({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      args: { url: 'https://example.com' },
    });

    expect(outcome.status).toBe('completed');
  });

  it('records permission_denied when the agent is missing a capability', async () => {
    const skills = new SkillRegistry();
    skills.register(readOnlySkill);
    const handlers = new HandlerRegistry();
    handlers.register('audit.cookie_scan', async () => ({ output_hash: 'should-not-run' }));
    const resolver = new InMemoryAgentResolver();
    resolver.register({
      agent_id: 'audit-agent',
      tenant_id: 'tenant-1',
      granted_capabilities: ['read:tenant.audit'], // missing network:external
    });
    const tracer = new NullTracer();
    const events = new InMemoryEventBus();
    const denied: unknown[] = [];
    events.subscribe('permission.denied', (e) => {
      denied.push(e.payload);
    });

    const exec = new Executor({
      registry: skills,
      handlers,
      permissions: new CapabilityPermissionChecker(resolver),
      tracer,
      events,
      gates: nullGates,
    });

    const outcome = await exec.execute({
      tenant_id: 'tenant-1',
      agent_id: 'audit-agent',
      skill_id: 'audit.cookie_scan',
      args: {},
    });

    expect(outcome.status).toBe('failed');
    if (outcome.status === 'failed') {
      expect(outcome.error_code).toBe('permission_denied');
    }
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ missing: ['network:external'] });
  });
});
