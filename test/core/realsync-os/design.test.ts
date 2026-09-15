import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DESIGN_AGENT_POLICY,
  approveSession,
  blueprintToDesign,
  createExecutionPlan,
  designToBlueprint,
  detectCapabilities,
  evaluateToolAction,
  openCommandSession,
  rejectSession,
  runIntentToCompletion,
  runUntilTerminal,
  walkTree,
  type Intent,
} from '../../../src/core/realsync-os';

const intent = (text: string): Intent => ({
  id: 'intent-1',
  text,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  createdAt: '2026-09-08T00:00:00.000Z',
});

const ids = () => {
  let n = 0;
  return {
    now: () => '2026-09-08T00:00:00.000Z',
    id: () => `id-${++n}`,
  };
};

describe('design capabilities', () => {
  it('routes a tax-advisor landing page through Design', () => {
    const caps = detectCapabilities('Erstelle eine moderne Landingpage für einen deutschen Steuerberater.');
    expect(caps).toContain('Design');
    expect(caps).toContain('Website');
  });

  it('does not treat an SEO audit as a design build', () => {
    expect(detectCapabilities('Prüfe meine Website auf SEO und Sichtbarkeit.')).toEqual(['Website', 'SEO']);
    expect(createExecutionPlan(intent('Prüfe meine Website auf SEO und Sichtbarkeit.')).steps.map((step) => step.action)).toEqual([
      'optimize_visibility',
    ]);
  });
});

describe('design planner', () => {
  it('emits a policy-aware design plan, not a coarse website plan', () => {
    const plan = createExecutionPlan(intent('Erstelle eine moderne Landingpage für einen deutschen Steuerberater.'));
    expect(plan.steps.map((step) => step.id)).toEqual([
      'discover', 'brand', 'system', 'wireframe', 'hero', 'sections', 'responsive', 'a11y', 'seo', 'governance', 'blueprint',
    ]);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps.some((step) => step.action === 'write_frontend')).toBe(false);
  });

  it('adds publish only when requested', () => {
    const plan = createExecutionPlan(intent('Landingpage bauen und deployen'));
    expect(plan.steps.at(-1)?.action).toBe('publish');
    expect(plan.risk).toBe('critical');
  });
});

describe('design policy', () => {
  it('denies production database and unrestricted personal data', () => {
    expect(evaluateToolAction(DEFAULT_DESIGN_AGENT_POLICY, 'production_database', 'write', 'low').allowed).toBe(false);
    expect(evaluateToolAction(DEFAULT_DESIGN_AGENT_POLICY, 'unrestricted_personal_data', 'read', 'low').allowed).toBe(false);
  });

  it('requires approval for production publish', () => {
    const decision = evaluateToolAction(DEFAULT_DESIGN_AGENT_POLICY, 'deployment', 'publish', 'critical');
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it('does not execute before approval', async () => {
    const session = await runIntentToCompletion(intent('Landingpage bauen'), ids());
    expect(session.phase).toBe('awaiting_approval');
    expect(session.steps.every((step) => step.status === 'pending')).toBe(true);
  });
});

describe('design kernel execution', () => {
  it('builds a semantic tree and SiteOS blueprint from a prompt, without faking deploy', async () => {
    const session = openCommandSession(intent('Erstelle eine moderne Landingpage für einen deutschen Steuerberater.'), ids());
    approveSession(session, 'user-1', ids());
    await runUntilTerminal(session, ids());

    expect(session.phase).toBe('completed');
    const project = session.artifacts.designProject;
    expect(project).toBeTruthy();
    expect(project?.inputMode).toBe('prompt');
    expect(project?.brand.vertical).toBe('tax-advisor');
    expect((project?.tokens.length ?? 0) >= 6).toBe(true);

    const doc = project!.documents[0];
    const walked = walkTree(doc).map((item) => item.node.id);
    expect(walked).toEqual(expect.arrayContaining(['page', 'hero', 'hero-cta', 'features', 'footer']));
    expect(doc.nodes.page.children.join(',')).toBe('header,hero,features,social_proof,footer');

    const blueprint = session.artifacts.siteosBlueprint;
    expect(blueprint?.kind).toBe('siteos.blueprint');
    expect(blueprint?.pages[0]?.sections.some((section) => section.type === 'hero')).toBe(true);
    expect(session.artifacts.siteUrl).toBeUndefined();
    expect(session.events.some((event) => event.stage === 'evidence')).toBe(true);

    const roundTrip = blueprintToDesign(blueprint!, 'tenant-1', '2026-09-08T00:00:00.000Z');
    expect(roundTrip.documents[0]?.nodes.hero).toBeTruthy();
    expect(designToBlueprint(project!).provenance.designProjectId).toBe(project!.id);
  });

  it('blocks screenshot import instead of faking vision', async () => {
    const session = openCommandSession(intent('Baue diese Website nach, aber moderner. screenshot.png'), ids());
    approveSession(session, 'user-1', ids());
    await runUntilTerminal(session, ids());
    const brand = session.steps.find((step) => step.stepId === 'brand');
    expect(brand?.notImplemented).toBe(true);
    expect(session.phase).toBe('blocked');
    expect(brand?.policyReason).toMatch(/NOT IMPLEMENTED/);
  });

  it('does not invent SEO scores', async () => {
    const session = openCommandSession(intent('Landingpage bauen und SEO prüfen'), ids());
    approveSession(session, 'user-1', ids());
    await runUntilTerminal(session, ids());
    const seo = session.steps.find((step) => step.stepId === 'seo');
    expect(seo?.status).toBe('succeeded');
    expect(seo?.observation?.rankingScore).toBeNull();
    expect(seo?.observation?.kind).toBe('seo_structural');
  });

  it('keeps publish unimplemented without a SiteOS gate', async () => {
    const session = openCommandSession(intent('Landingpage bauen und publish'), ids());
    approveSession(session, 'user-1', ids());
    await runUntilTerminal(session, ids());
    const publish = session.steps.find((step) => step.stepId === 'publish');
    expect(publish?.notImplemented).toBe(true);
    expect(session.phase).toBe('blocked');
    expect(session.artifacts.designProject).toBeTruthy();
    expect(session.artifacts.siteosBlueprint).toBeTruthy();
  });

  it('rejects without touching design state', () => {
    const session = openCommandSession(intent('Landingpage bauen'), ids());
    rejectSession(session, 'user-1', 'not now', ids());
    expect(session.phase).toBe('rejected');
    expect(session.artifacts.designProject).toBeUndefined();
  });
});
