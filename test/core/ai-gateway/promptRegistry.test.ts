import { describe, it, expect } from 'vitest';
import { promptRegistry, getPrompt, type PromptKey } from '../../../src/core/ai-gateway/promptRegistry';

const ALL_KEYS: readonly PromptKey[] = [
  'governance_chat',
  'audit_finding_explain',
  'ai_act_classify',
  'evidence_summary',
  'policy_explain',
];

describe('promptRegistry', () => {
  it('exposes every PromptKey', () => {
    for (const key of ALL_KEYS) {
      expect(promptRegistry[key]).toBeDefined();
    }
  });

  it('every entry has a version, feature tag and non-empty system prompt', () => {
    for (const key of ALL_KEYS) {
      const entry = promptRegistry[key];
      expect(entry.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.feature.length).toBeGreaterThan(0);
      expect(entry.system.length).toBeGreaterThan(10);
    }
  });

  it('getPrompt returns the entry by key', () => {
    expect(getPrompt('governance_chat').feature).toBe('governance_chat');
    expect(getPrompt('audit_finding_explain').system).toMatch(/audit finding/i);
  });
});
