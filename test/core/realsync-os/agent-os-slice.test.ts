import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_ARTIFACT_IDS,
  approveSession,
  createExecutionPlan,
  getRunnableMeshAgents,
  isComplianceIntent,
  listMeshAgents,
  openCommandSession,
  runUntilTerminal,
  type Intent,
} from '../../../src/core/realsync-os';
import { getImplementation } from '../../../src/product/implementation-status';

const intent = (text: string): Intent => ({
  id: 'intent-compliance-1',
  text,
  tenantId: 'tenant-1',
  actorId: 'user-1',
  createdAt: '2026-09-12T00:00:00.000Z',
});

const ids = (() => {
  let n = 0;
  return {
    now: () => '2026-09-12T00:00:00.000Z',
    id: () => `id-${++n}`,
  };
})();

describe('Agent OS — compliance artifacts', () => {
  it('detects compliance intents', () => {
    expect(isComplianceIntent('Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.')).toBe(true);
    expect(isComplianceIntent('Landingpage bauen')).toBe(false);
  });

  it('builds the locked 10-step artifact plan', () => {
    const plan = createExecutionPlan(intent('Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.'));
    expect(plan.steps.map((step) => step.id)).toEqual([...COMPLIANCE_ARTIFACT_IDS]);
    expect(plan.requiresApproval).toBe(true);
    expect(plan.risk).toBe('high');
    expect(plan.steps.every((step) => step.agent === 'compliance')).toBe(true);
  });

  it('opens awaiting approval and does not auto-execute', () => {
    const session = openCommandSession(
      intent('Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.'),
      ids,
    );
    expect(session.phase).toBe('awaiting_approval');
    expect(session.approved).toBe(false);
    expect(session.steps.every((step) => step.status === 'pending')).toBe(true);
  });

  it('runs compliance preview steps after approval without fake SiteOS success on evaluate_governance', async () => {
    const session = openCommandSession(
      intent('Prüfe meine KI-Anwendung auf DSGVO und EU AI Act.'),
      ids,
    );
    approveSession(session, 'user-1', ids);
    await runUntilTerminal(session, ids);

    const beforeResults = ['aufgabe', 'pruefplan', 'benoetigte_daten', 'aktionen', 'risiko'];
    for (const id of beforeResults) {
      const state = session.steps.find((step) => step.stepId === id);
      expect(state?.status).toBe('succeeded');
      expect(state?.observation?.preview).toBe(true);
    }

    const results = session.steps.find((step) => step.stepId === 'ergebnisse');
    expect(results?.notImplemented).toBe(true);
    expect(session.phase).toBe('blocked');
  });
});

describe('Agent OS — mesh registry', () => {
  it('lists specialists and only Compliance is runnable', () => {
    const mesh = listMeshAgents();
    expect(mesh.length).toBeGreaterThanOrEqual(16);
    expect(getRunnableMeshAgents().map((a) => a.id)).toEqual(['compliance']);
    expect(mesh.find((a) => a.id === 'marketing')?.maturity).toBe('coming-soon');
  });
});

describe('implementation-status — Agent OS entries', () => {
  it('registers Agent OS as preview/coming-soon — never fake live', () => {
    const ids = [
      'agent-os-command-center',
      'agent-os-mesh-compliance',
      'agent-os-mesh-specialists',
      'agent-os-chrome-side-panel',
      'agent-os-hostinger-workers',
      'agent-os-product-evolution',
    ];
    for (const id of ids) {
      const entry = getImplementation(id);
      expect(entry, id).toBeTruthy();
      expect(entry!.status).not.toBe('live');
    }
  });
});
