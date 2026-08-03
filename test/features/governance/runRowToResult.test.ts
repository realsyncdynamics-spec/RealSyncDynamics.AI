/**
 * runRowToResult — adapts a stored history row into the AgentRunResult shape
 * rendered by AgentRunOutput, so a past run can be re-opened from the history
 * list. Verifies field mapping and graceful degradation for older rows that
 * lack the detail fields.
 */
import { describe, it, expect } from 'vitest';
import { runRowToResult, type AgentRunRow } from '@/src/features/governance/agents/agentsApi';

function makeRow(overrides: Partial<AgentRunRow> = {}): AgentRunRow {
  return {
    id: 'run-1',
    tenant_id: 'tenant-1',
    agent_id: 'risk-classification-agent',
    actor: 'dashboard-user',
    status: 'requires_approval',
    summary: 'Health-Daten erkannt.',
    created_at: '2026-07-21T00:00:00.000Z',
    ...overrides,
  };
}

describe('runRowToResult', () => {
  it('maps a full history row to an AgentRunResult', () => {
    const row = makeRow({
      findings: [{ id: 'f1', title: 'Sensible Datenkategorie', severity: 'critical' }],
      recommendations: [{ id: 'r1', title: 'Freigabe', priority: 'urgent', requiresHumanApproval: true }],
      metadata: { riskLevel: 'high' },
    });
    const result = runRowToResult(row);

    expect(result.agentId).toBe('risk-classification-agent');
    expect(result.status).toBe('requires_approval');
    expect(result.summary).toBe('Health-Daten erkannt.');
    expect(result.findings).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
    expect(result.metadata).toEqual({ riskLevel: 'high' });
    expect(result.run_id).toBe('run-1');
    expect(result.auditEvents).toEqual([]);
    expect(result.persist_error).toBeNull();
  });

  it('degrades to empty lists when detail fields are absent (older rows)', () => {
    const result = runRowToResult(makeRow());
    expect(result.findings).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.metadata).toEqual({});
    // run_id still resolves so the detail view has an identity
    expect(result.run_id).toBe('run-1');
  });
});
