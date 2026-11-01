import { describe, expect, it } from 'vitest';
import { groupOpenQuestions, type AgentQuestionRow } from '../../src/features/command-center/decisionInbox';

let n = 0;
const q = (p: Partial<AgentQuestionRow>): AgentQuestionRow => ({
  id: `q${++n}`, agent_ref: 'grok:a', task_ref: null, milestone: null, project: null,
  question: 'Frage?', context: null, priority: 'P2', status: 'open', dedupe_key: `k${n}`,
  is_demo: false, created_at: `2026-10-29T10:0${n % 10}:00Z`, ...p,
});

describe('groupOpenQuestions', () => {
  it('sortiert nach P0–P3, dann älteste zuerst', () => {
    const g = groupOpenQuestions([
      q({ priority: 'P3', created_at: '2026-10-29T08:00:00Z' }),
      q({ priority: 'P0', created_at: '2026-10-29T12:00:00Z' }),
      q({ priority: 'P1', created_at: '2026-10-29T11:00:00Z' }),
      q({ priority: 'P1', created_at: '2026-10-29T09:00:00Z' }),
    ]);
    expect(g.map((x) => `${x.priority}@${x.primary.created_at.slice(11, 13)}`)).toEqual(['P0@12', 'P1@09', 'P1@11', 'P3@08']);
  });

  it('fasst Duplikate zusammen, höchste Priorität gewinnt, Agenten gesammelt', () => {
    const g = groupOpenQuestions([
      q({ dedupe_key: 'same', priority: 'P2', agent_ref: 'grok:a', created_at: '2026-10-29T08:00:00Z' }),
      q({ dedupe_key: 'same', priority: 'P0', agent_ref: 'grok:b', created_at: '2026-10-29T09:00:00Z' }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.priority).toBe('P0');
    expect(g[0]!.members).toHaveLength(2);
    expect(g[0]!.agents).toEqual(['grok:a', 'grok:b']);
  });

  it('ignoriert nicht-offene Fragen', () => {
    expect(groupOpenQuestions([q({ status: 'answered' }), q({ status: 'deferred' })])).toEqual([]);
  });

  it('mischt Demo und echte Daten nie in einer Gruppe', () => {
    const g = groupOpenQuestions([q({ dedupe_key: 'x', is_demo: true }), q({ dedupe_key: 'x', is_demo: false })]);
    expect(g).toHaveLength(2);
    expect(g.filter((x) => x.isDemo)).toHaveLength(1);
  });
});
