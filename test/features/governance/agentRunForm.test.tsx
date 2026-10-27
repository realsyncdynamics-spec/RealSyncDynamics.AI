/**
 * AgentRunForm + agentInputSchemas — verifies the payload-building helpers,
 * the schema/agent-implementation key alignment, the WP12 governance_approvals
 * approval gate (via approvalsApi.ts), and that the rendered form collects
 * values and submits a correctly-typed payload only when approved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import {
  AgentRunForm,
  parseTags,
  buildPayload,
  hasApprovedAgentEntry,
} from '@/src/features/governance/agents/AgentRunForm';
import {
  AGENT_INPUT_SCHEMAS,
  hasInputSchema,
  type AgentInputField,
} from '@/src/features/governance/agents/agentInputSchemas';
import type { Approval } from '@/src/features/governance/approvalsApi';

const mockListApprovals = vi.fn();

vi.mock('@/src/features/governance/approvalsApi', () => ({
  listApprovals: (...args: unknown[]) => mockListApprovals(...args),
}));

const approvedEntry: Approval = {
  id: 'app-1',
  tenant_id: 'tenant-1',
  event_id: 'evt-1',
  policy_id: null,
  asset_id: null,
  status: 'approved',
  requested_action: 'run_agent',
  resolved_by: 'user-1',
  resolved_at: '2026-10-26T12:00:00Z',
  resolution_reason: 'Freigegeben',
  expires_at: '2026-11-26T12:00:00Z',
  created_at: '2026-10-26T11:00:00Z',
  event: null,
  policy: null,
  asset: null,
};

beforeEach(() => {
  mockListApprovals.mockReset();
  mockListApprovals.mockResolvedValue({ ok: true, approvals: [approvedEntry] });
});

describe('parseTags', () => {
  it('splits on commas and newlines, trimming and dropping empties', () => {
    expect(parseTags('health_data, pii\n\n biometric_data ,')).toEqual([
      'health_data',
      'pii',
      'biometric_data',
    ]);
  });

  it('returns an empty array for blank input', () => {
    expect(parseTags('   ')).toEqual([]);
  });
});

describe('buildPayload', () => {
  const fields: AgentInputField[] = [
    { key: 'systemName', label: 'System', kind: 'text' },
    { key: 'dataCategories', label: 'Kategorien', kind: 'tags' },
    { key: 'externalAction', label: 'Extern', kind: 'boolean' },
    { key: 'riskLevel', label: 'Risiko', kind: 'select', options: [{ value: 'high', label: 'Hoch' }] },
  ];

  it('omits empty strings and empty tag arrays', () => {
    const payload = buildPayload(fields, {
      systemName: '   ',
      dataCategories: [],
      externalAction: false,
      riskLevel: 'high',
    });
    expect(payload).toEqual({ externalAction: false, riskLevel: 'high' });
  });

  it('includes populated values with correct types', () => {
    const payload = buildPayload(fields, {
      systemName: 'Recruiter',
      dataCategories: ['health_data'],
      externalAction: true,
      riskLevel: 'high',
    });
    expect(payload).toEqual({
      systemName: 'Recruiter',
      dataCategories: ['health_data'],
      externalAction: true,
      riskLevel: 'high',
    });
  });
});

describe('AGENT_INPUT_SCHEMAS', () => {
  it('marks discovery and risk agents as having input schemas', () => {
    expect(hasInputSchema('ai-discovery-agent')).toBe(true);
    expect(hasInputSchema('risk-classification-agent')).toBe(true);
  });

  it('does not define a schema for the infrastructure agent', () => {
    expect(hasInputSchema('infrastructure-agent')).toBe(false);
  });

  it('every select field has at least one option', () => {
    for (const fields of Object.values(AGENT_INPUT_SCHEMAS)) {
      for (const f of fields ?? []) {
        if (f.kind === 'select') expect((f.options ?? []).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('hasApprovedAgentEntry', () => {
  it('returns false for empty or non-approved lists', () => {
    expect(hasApprovedAgentEntry(undefined)).toBe(false);
    expect(hasApprovedAgentEntry([])).toBe(false);
    expect(
      hasApprovedAgentEntry([{ ...approvedEntry, status: 'pending' }]),
    ).toBe(false);
  });

  it('returns true when an approved entry exists for the agent or tenant', () => {
    expect(hasApprovedAgentEntry([approvedEntry])).toBe(true);
    expect(
      hasApprovedAgentEntry(
        [{ ...approvedEntry, asset_id: 'risk-classification-agent' }],
        'risk-classification-agent',
      ),
    ).toBe(true);
    expect(
      hasApprovedAgentEntry(
        [{ ...approvedEntry, asset_id: 'other-agent' }],
        'risk-classification-agent',
      ),
    ).toBe(false);
  });
});

describe('AgentRunForm render & WP12 approval gate', () => {
  it('collects field values and submits a typed payload when approved', async () => {
    const onSubmit = vi.fn();
    const fields = AGENT_INPUT_SCHEMAS['risk-classification-agent']!;
    const { getByLabelText, getByRole } = render(
      <AgentRunForm fields={fields} busy={false} tenantId="tenant-1" onSubmit={onSubmit} />,
    );

    const startBtn = getByRole('button', { name: /Skill starten/ }) as HTMLButtonElement;
    await waitFor(() => expect(startBtn.disabled).toBe(false));
    expect(mockListApprovals).toHaveBeenCalledWith('tenant-1', 'approved');

    fireEvent.change(getByLabelText('Systemname'), { target: { value: 'Recruiting-Bot' } });
    fireEvent.change(getByLabelText('Datenkategorien'), { target: { value: 'health_data, pii' } });
    fireEvent.change(getByLabelText('Nutzungskontext'), { target: { value: 'Bewerber-Screening' } });
    fireEvent.click(startBtn);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      systemName: 'Recruiting-Bot',
      dataCategories: ['health_data', 'pii'],
      usageContext: 'Bewerber-Screening',
    });
  });

  it('blocks starting an agent without approval and shows "Freigabe anfordern"', async () => {
    mockListApprovals.mockResolvedValueOnce({ ok: true, approvals: [] });
    const onSubmit = vi.fn();
    const fields = AGENT_INPUT_SCHEMAS['risk-classification-agent']!;
    const { getByRole, getByText } = render(
      <AgentRunForm
        fields={fields}
        busy={false}
        tenantId="tenant-1"
        agentId="risk-classification-agent"
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => expect(mockListApprovals).toHaveBeenCalledWith('tenant-1', 'approved'));

    const startBtn = getByRole('button', { name: /Skill starten/ }) as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
    fireEvent.click(startBtn);
    expect(onSubmit).not.toHaveBeenCalled();

    const requestLink = getByText('Freigabe anfordern');
    expect(requestLink).toBeTruthy();
    expect(requestLink.getAttribute('href')).toBe('/governance/approvals');
  });

  it('disables the submit button while busy', async () => {
    const fields = AGENT_INPUT_SCHEMAS['ai-discovery-agent']!;
    const { getByRole } = render(<AgentRunForm fields={fields} busy onSubmit={() => {}} />);
    await waitFor(() => expect(mockListApprovals).toHaveBeenCalled());
    expect((getByRole('button', { name: /Skill starten/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
