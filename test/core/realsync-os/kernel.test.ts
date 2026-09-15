import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEBSITE_AGENT_POLICY,
  approveSession,
  createExecutionPlan,
  detectCapabilities,
  evaluateToolAction,
  openCommandSession,
  rejectSession,
  runIntentToCompletion,
  runUntilTerminal,
  type Intent,
  type StepExecutor,
} from '../../../src/core/realsync-os';

const intent = (text: string): Intent => ({
  id: 'intent-1',
  text,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  createdAt: '2026-09-08T00:00:00.000Z',
});

const ids = (() => {
  let n = 0;
  return {
    now: () => '2026-09-08T00:00:00.000Z',
    id: () => `id-${++n}`,
  };
})();

describe('detectCapabilities', () => {
  it('detects website, seo, governance and deploy', () => {
    expect(detectCapabilities('Build a SaaS landing page, optimize SEO and publish it. DSGVO prüfen.'))
      .toEqual(['Website', 'Design', 'Code', 'SEO', 'Governance', 'Deployment']);
  });

  it('returns empty when nothing matches', () => {
    expect(detectCapabilities('just think about this')).toEqual([]);
  });
});

describe('createExecutionPlan', () => {
  it('builds a design + deploy plan with approval on publish', () => {
    const plan = createExecutionPlan(intent('Landingpage bauen und deployen'));
    expect(plan.steps.map((step) => step.id)).toEqual([
      'discover', 'brand', 'system', 'wireframe', 'hero', 'sections', 'responsive', 'a11y', 'seo', 'governance', 'blueprint', 'publish',
    ]);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.risk).toBe('critical');
    expect(plan.capabilities).toContain('Design');
    expect(plan.capabilities).toContain('Deployment');
  });

  it('falls back to orchestrator discovery', () => {
    const plan = createExecutionPlan(intent('hilf mir weiter'));
    expect(plan.steps.map((step) => step.action)).toEqual(['discover', 'refine_plan']);
    expect(plan.requiresApproval).toBe(false);
  });
});

describe('policyEngine', () => {
  it('denies unknown actions by default', () => {
    const decision = evaluateToolAction(DEFAULT_WEBSITE_AGENT_POLICY, 'secrets', 'read', 'low');
    expect(decision.allowed).toBe(false);
  });

  it('requires approval for production publish', () => {
    const decision = evaluateToolAction(DEFAULT_WEBSITE_AGENT_POLICY, 'deployment', 'publish', 'critical');
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });
});

describe('command center loop', () => {
  it('does not execute on open — plan first', async () => {
    const session = await runIntentToCompletion(intent('Landingpage bauen und deployen'), ids);
    expect(session.phase).toBe('awaiting_approval');
    expect(session.steps.every((step) => step.status === 'pending')).toBe(true);
    expect(session.approved).toBe(false);
  });

  it('rejects without executing', () => {
    const session = openCommandSession(intent('Landingpage bauen und deployen'), ids);
    rejectSession(session, 'user-1', 'not now', ids);
    expect(session.phase).toBe('rejected');
    expect(session.steps.every((step) => step.status === 'pending')).toBe(true);
  });

  it('does not fake SiteOS success without an executor', async () => {
    const session = openCommandSession(intent('Prüfe meine Website auf SEO'), ids);
    approveSession(session, 'user-1', ids);
    await runUntilTerminal(session, ids);
    const seo = session.steps.find((step) => step.stepId === 'seo');
    expect(seo?.notImplemented).toBe(true);
    expect(seo?.status).toBe('blocked');
    expect(session.phase).toBe('blocked');
    expect(session.events.some((event) => event.metadata?.notImplemented === true)).toBe(true);
  });

  it('executes through a bound executor and records observe/verify/evidence', async () => {
    const executeStep: StepExecutor = ({ step }) => ({
      status: 'succeeded',
      tool: `test.${step.action}`,
      observation: { ran: true },
      artifacts: step.action === 'publish' ? { blueprintId: 'bp-1', slug: 'acme' } : undefined,
    });

    const session = await runIntentToCompletion(intent('Landingpage bauen und deployen'), {
      ...ids,
      autoApprove: true,
      executeStep,
    });

    expect(session.phase).toBe('completed');
    expect(session.approved).toBe(true);
    expect(session.steps.every((step) => step.status === 'succeeded')).toBe(true);
    expect(session.artifacts.designProject).toBeTruthy();
    expect(session.artifacts.siteosBlueprint?.kind).toBe('siteos.blueprint');
    expect(session.artifacts.blueprintId).toBe('bp-1');
    expect(session.events.some((event) => event.stage === 'observe')).toBe(true);
    expect(session.events.some((event) => event.stage === 'verify' && event.action === 'complete_session')).toBe(true);
    expect(session.events.some((event) => event.stage === 'evidence')).toBe(true);
  });

  it('keeps plan-level approval for later high-risk steps', async () => {
    const executeStep: StepExecutor = () => ({ status: 'succeeded', tool: 'test', observation: {} });
    const session = openCommandSession(intent('Landingpage bauen, DSGVO prüfen und publish'), ids);
    expect(session.phase).toBe('awaiting_approval');
    approveSession(session, 'user-1', ids);
    await runUntilTerminal(session, { ...ids, executeStep });
    expect(session.phase).toBe('completed');
    const deploy = session.steps.find((step) => step.stepId === 'publish' || step.stepId === 'deploy');
    expect(deploy?.status).toBe('succeeded');
  });
});
