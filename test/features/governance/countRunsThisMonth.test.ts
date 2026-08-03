/**
 * countRunsThisMonth — counts agent runs created in the same UTC month as the
 * reference date. This is the billable monthly count surfaced in the Agent
 * Center (metered entitlement limit.agent_runs_monthly).
 */
import { describe, it, expect } from 'vitest';
import { countRunsThisMonth, type AgentRunRow } from '@/src/features/governance/agents/agentsApi';

function row(created_at: string): AgentRunRow {
  return {
    id: Math.random().toString(36).slice(2),
    tenant_id: 't1',
    agent_id: 'audit-agent',
    actor: 'user',
    status: 'success',
    summary: '',
    created_at,
  };
}

describe('countRunsThisMonth', () => {
  const now = new Date('2026-07-15T12:00:00.000Z');

  it('counts only runs in the same UTC month', () => {
    const rows = [
      row('2026-07-01T00:00:00.000Z'),
      row('2026-07-31T23:59:59.000Z'),
      row('2026-06-30T23:59:59.000Z'), // previous month
      row('2026-08-01T00:00:00.000Z'), // next month
      row('2025-07-15T12:00:00.000Z'), // same month, previous year
    ];
    expect(countRunsThisMonth(rows, now)).toBe(2);
  });

  it('ignores rows with an unparseable created_at', () => {
    expect(countRunsThisMonth([row('2026-07-10T00:00:00.000Z'), row('not-a-date')], now)).toBe(1);
  });

  it('returns 0 for an empty list', () => {
    expect(countRunsThisMonth([], now)).toBe(0);
  });
});
