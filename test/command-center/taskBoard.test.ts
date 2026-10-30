import { describe, expect, it } from 'vitest';
import {
  claimState, columnOf, filterTasks, groupByColumn, openDependencies, shortId, wouldCreateDelegationCycle,
  EMPTY_TASK_FILTER,
} from '../../src/features/command-center/taskBoard';
import { mk } from './taskFixtures';


describe('taskBoard', () => {
  it('columnOf: board_status vor Legacy-Status; failed/cancelled nicht auf Board', () => {
    expect(columnOf(mk('1', { board_status: 'in_review', status: 'in_progress' }))).toBe('in_review');
    expect(columnOf(mk('1', { status: 'open' }))).toBe('backlog');
    expect(columnOf(mk('1', { status: 'blocked' }))).toBe('blocked');
    expect(columnOf(mk('1', { status: 'failed' }))).toBeNull();
  });
  it('groupByColumn hat alle 7 Spalten', () => {
    const g = groupByColumn([mk('1'), mk('2', { board_status: 'done' }), mk('3', { status: 'cancelled' })]);
    expect(Object.keys(g)).toEqual(['backlog', 'planned', 'in_progress', 'awaiting_decision', 'blocked', 'in_review', 'done']);
    expect(g.backlog).toHaveLength(1); expect(g.done).toHaveLength(1);
  });
  it('filterTasks nach Agent/Projekt/Priorität/Suche inkl. Kurz-ID', () => {
    const rows = [mk('aaaaaaaa-1', { agent: 'x', project: 'P' }), mk('bbbbbbbb-2', { priority: 'high' })];
    expect(filterTasks(rows, { ...EMPTY_TASK_FILTER, agent: 'x' })).toHaveLength(1);
    expect(filterTasks(rows, { ...EMPTY_TASK_FILTER, project: '__unset__' })[0]!.id).toBe('bbbbbbbb-2');
    expect(filterTasks(rows, { ...EMPTY_TASK_FILTER, priority: 'high' })).toHaveLength(1);
    expect(filterTasks(rows, { ...EMPTY_TASK_FILTER, query: 't-bbbb' })).toHaveLength(1);
    expect(shortId('bbbbbbbb-2222')).toBe('T-BBBBBBBB');
  });
  it('openDependencies und claimState', () => {
    const a = mk('a', { board_status: 'done' }); const b = mk('b');
    const t = mk('t', { depends_on: ['a', 'b', 'unbekannt'] });
    expect(openDependencies(t, new Map([[a.id, a], [b.id, b]]))).toEqual(['b', 'unbekannt']);
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(claimState(mk('x'), now)).toBe('free');
    expect(claimState(mk('x', { claimed_by: 'a', claim_expires_at: '2026-10-30T13:00:00Z' }), now)).toBe('held');
    expect(claimState(mk('x', { claimed_by: 'a', claim_expires_at: '2026-10-30T11:00:00Z' }), now)).toBe('expired');
  });
  it('wouldCreateDelegationCycle (Vorprüfung; Server verbindlich)', () => {
    const A = mk('A', { agent: 'a' }); const B = mk('B', { agent: 'b', parent_task_id: 'A' });
    const m = new Map([[A.id, A], [B.id, B]]);
    expect(wouldCreateDelegationCycle('a', 'B', m)).toBe(true);
    expect(wouldCreateDelegationCycle('b', 'B', m)).toBe(false);
    expect(wouldCreateDelegationCycle('c', 'B', m)).toBe(false);
  });
});
