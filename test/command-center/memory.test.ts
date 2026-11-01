import { describe, expect, it } from 'vitest';
import { precedentsFor, routineHealth, type KnowledgeHit, type RoutineStatusRow } from '../../src/features/command-center/memory';

const r = (p: Partial<RoutineStatusRow>): RoutineStatusRow => ({
  source: 'routine', id: '1', key: 'k', label: 'L', agent_ref: null, schedule: null, enabled: true, expected_interval_minutes: 60,
  last_run_at: null, last_status: null, last_error: null, last_summary: null, failures_7d: 0, next_run_at: null, ...p,
});
const now = Date.parse('2026-10-30T12:00:00Z');

describe('routineHealth', () => {
  it('leitet Zustand nur aus belegten Läufen ab', () => {
    expect(routineHealth(r({ enabled: false }), now)).toBe('disabled');
    expect(routineHealth(r({}), now)).toBe('never');
    expect(routineHealth(r({ last_run_at: '2026-10-30T11:30:00Z', last_status: 'failure' }), now)).toBe('failing');
    expect(routineHealth(r({ last_run_at: '2026-10-30T10:00:00Z', last_status: 'success' }), now)).toBe('overdue');
    expect(routineHealth(r({ last_run_at: '2026-10-30T11:30:00Z', last_status: 'success' }), now)).toBe('ok');
    expect(routineHealth(r({ source: 'scan_schedule', expected_interval_minutes: null, last_run_at: '2026-10-30T11:30:00Z' }), now)).toBe('unknown');
  });
});

describe('precedentsFor', () => {
  it('nur andere Entscheidungen', () => {
    const h = (id: string, kind: KnowledgeHit['kind']): KnowledgeHit => ({ kind, id, title: id, snippet: null, status: 'approved', agent: null, created_at: '2026-10-01T00:00:00Z', decision_id: null });
    expect(precedentsFor([h('self', 'decision'), h('x', 'decision'), h('m', 'memory')], 'self').map((x) => x.id)).toEqual(['x']);
  });
});
