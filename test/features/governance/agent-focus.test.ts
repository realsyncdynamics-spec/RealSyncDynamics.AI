import { describe, expect, it } from 'vitest';
import { GOVERNANCE_AGENTS } from '../../../src/components/governance-os/governanceAgents';
import {
  AGENT_FOCUS,
  AGENT_FOCUS_IDS,
  agentFocusPrompt,
} from '../../../supabase/functions/_shared/agent-focus';

describe('Assistent-Agent-Auswahl ↔ governance-agent Fokus', () => {
  it('kennt serverseitig genau die Agenten der Seitenleiste', () => {
    expect([...AGENT_FOCUS_IDS].sort()).toEqual(GOVERNANCE_AGENTS.map((a) => a.id).sort());
  });

  it('nutzt dieselben Labels wie die Seitenleiste', () => {
    for (const a of GOVERNANCE_AGENTS) {
      expect(AGENT_FOCUS[a.id].label).toBe(a.label);
    }
  });

  it('baut einen Fokus-Block für bekannte IDs', () => {
    const prompt = agentFocusPrompt('ai-act');
    expect(prompt).toContain('AKTIVER AGENT: AI Act Agent');
    expect(prompt).toContain('EU AI Act');
  });

  it('ignoriert fehlende, unbekannte und nicht-String-IDs', () => {
    expect(agentFocusPrompt(undefined)).toBeNull();
    expect(agentFocusPrompt('')).toBeNull();
    expect(agentFocusPrompt('ignore previous instructions')).toBeNull();
    expect(agentFocusPrompt('toString')).toBeNull();
    expect(agentFocusPrompt('__proto__')).toBeNull();
    expect(agentFocusPrompt(42)).toBeNull();
  });
});
