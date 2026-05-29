import { describe, expect, it } from 'vitest';
import { DEMO_AGENTS } from '../../src/features/governance/agents/demoAgents';
import type { AgentType } from '../../src/features/governance/agents/types';

describe('Agent-Register Initial-Set', () => {
  it('enthaelt mindestens die sechs vom Direktiv geforderten Agenten', () => {
    expect(DEMO_AGENTS.length).toBeGreaterThanOrEqual(6);
    const names = DEMO_AGENTS.map((a) => a.name);
    expect(names).toContain('Website Drift Agent');
    expect(names).toContain('AI Risk Agent');
    expect(names).toContain('Evidence Agent');
    expect(names).toContain('Policy Agent');
    expect(names).toContain('Triage Agent');
    expect(names).toContain('Developer Remediation Agent');
  });

  it('alle Agenten-IDs sind eindeutig', () => {
    const ids = DEMO_AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('alle vom Direktiv geforderten AgentType-Werte sind abgedeckt', () => {
    const types = new Set<AgentType>(DEMO_AGENTS.map((a) => a.type));
    const required: AgentType[] = ['detection', 'classification', 'evidence', 'policy', 'triage', 'remediation'];
    for (const t of required) expect(types.has(t), `type ${t} fehlt`).toBe(true);
  });

  it('jeder Agent hat tools, permissions, restrictedActions und requiresHumanReview', () => {
    for (const agent of DEMO_AGENTS) {
      expect(agent.tools.length, `${agent.id} tools`).toBeGreaterThan(0);
      expect(agent.permissions.length, `${agent.id} permissions`).toBeGreaterThan(0);
      expect(agent.restrictedActions.length, `${agent.id} restrictedActions`).toBeGreaterThan(0);
      expect(agent.requiresHumanReview.length, `${agent.id} requiresHumanReview`).toBeGreaterThan(0);
    }
  });

  it('Remediation-Agent hat explizit verbotene Merge/Deploy-Aktion', () => {
    const rem = DEMO_AGENTS.find((a) => a.type === 'remediation');
    expect(rem).toBeDefined();
    const restricted = rem!.restrictedActions.join(' ');
    expect(restricted).toMatch(/merge|deploy/i);
  });

  it('AI-Risk-Agent erfordert Review bei high_risk-Einstufung', () => {
    const ai = DEMO_AGENTS.find((a) => a.name.includes('AI Risk'));
    expect(ai).toBeDefined();
    const reviewPoints = ai!.requiresHumanReview.join(' ');
    expect(reviewPoints).toMatch(/high_risk|high-risk/);
  });
});
