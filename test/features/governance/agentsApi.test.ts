/**
 * agentsApi — consistency tests for the registry-derived label maps used by
 * AgentsCenterView. The Edge-Function wrappers (runAgent/fetchAgentRuns) are
 * network pass-throughs and not mocked here.
 */
import { describe, expect, it } from 'vitest';
import {
  enterpriseAgents,
  AUTONOMY_LABELS,
  AGENT_STATUS_LABELS,
} from '@/src/features/governance/agents/agentsApi';

describe('agentsApi / registry', () => {
  it('exposes the seven enterprise agents', () => {
    expect(enterpriseAgents).toHaveLength(7);
  });

  it('has a German autonomy label for every agent autonomyLevel', () => {
    for (const a of enterpriseAgents) {
      expect(AUTONOMY_LABELS[a.autonomyLevel]).toBeTruthy();
    }
  });

  it('has a German status label for every agent status', () => {
    for (const a of enterpriseAgents) {
      expect(AGENT_STATUS_LABELS[a.status]).toBeTruthy();
    }
  });

  it('every agent has a stable id and at least one capability', () => {
    for (const a of enterpriseAgents) {
      expect(a.id).toMatch(/-agent$/);
      expect(a.capabilities.length).toBeGreaterThan(0);
    }
  });
});
