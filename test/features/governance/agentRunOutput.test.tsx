/**
 * AgentRunOutput — verifies the run-result renderer surfaces status, summary,
 * findings (with severity labels) and recommendations (with priority labels)
 * as readable text, and handles the empty-findings case gracefully.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AgentRunOutput } from '@/src/features/governance/agents/AgentRunOutput';
import type { AgentRunResult } from '@/src/features/governance/agents/agentsApi';

function makeResult(overrides: Partial<AgentRunResult> = {}): AgentRunResult {
  return {
    agentId: 'ai-discovery-agent',
    status: 'success',
    summary: 'Scan abgeschlossen.',
    findings: [],
    recommendations: [],
    auditEvents: [],
    metadata: {},
    run_id: null,
    persist_error: null,
    ...overrides,
  };
}

describe('AgentRunOutput', () => {
  it('renders status label, summary, findings and recommendations', () => {
    const result = makeResult({
      status: 'requires_approval',
      summary: 'Health-Daten erkannt.',
      findings: [
        {
          id: 'f1',
          title: 'Sensible Datenkategorie',
          description: 'health_data verarbeitet',
          severity: 'critical',
          riskLevel: 'high',
          evidence: { metric: 'health_data', value: 10 },
        },
      ],
      recommendations: [
        {
          id: 'r1',
          title: 'Governance-Freigabe',
          description: 'DPIA dokumentieren',
          priority: 'urgent',
          requiresHumanApproval: true,
        },
      ],
    });

    const { getByText, getAllByText } = render(<AgentRunOutput result={result} />);

    // "Freigabe erforderlich" appears twice: status badge + approval badge
    expect(getAllByText('Freigabe erforderlich').length).toBe(2);
    expect(getByText('Health-Daten erkannt.')).toBeDefined();
    expect(getByText('Sensible Datenkategorie')).toBeDefined();
    expect(getByText('Kritisch')).toBeDefined();
    expect(getByText('Governance-Freigabe')).toBeDefined();
    expect(getByText('Dringend')).toBeDefined();
    // Evidence key/value surfaced
    expect(getByText('metric')).toBeDefined();
  });

  it('shows a friendly empty state when there are no findings', () => {
    const { getByText } = render(<AgentRunOutput result={makeResult()} />);
    expect(getByText(/Keine Befunde/)).toBeDefined();
    expect(getByText(/Keine Empfehlungen/)).toBeDefined();
  });
});
