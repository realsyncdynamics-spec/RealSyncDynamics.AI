/**
 * AgentRunForm + agentInputSchemas — verifies the payload-building helpers,
 * the schema/agent-implementation key alignment, and that the rendered form
 * collects values and submits a correctly-typed payload.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AgentRunForm, parseTags, buildPayload } from '@/src/features/governance/agents/AgentRunForm';
import {
  AGENT_INPUT_SCHEMAS,
  hasInputSchema,
  type AgentInputField,
} from '@/src/features/governance/agents/agentInputSchemas';

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

describe('AgentRunForm render', () => {
  it('collects field values and submits a typed payload', () => {
    const onSubmit = vi.fn();
    const fields = AGENT_INPUT_SCHEMAS['risk-classification-agent']!;
    const { getByLabelText, getByRole } = render(
      <AgentRunForm fields={fields} busy={false} onSubmit={onSubmit} />,
    );

    fireEvent.change(getByLabelText('Systemname'), { target: { value: 'Recruiting-Bot' } });
    fireEvent.change(getByLabelText('Datenkategorien'), { target: { value: 'health_data, pii' } });
    fireEvent.change(getByLabelText('Nutzungskontext'), { target: { value: 'Bewerber-Screening' } });
    fireEvent.click(getByRole('button', { name: /Skill starten/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      systemName: 'Recruiting-Bot',
      dataCategories: ['health_data', 'pii'],
      usageContext: 'Bewerber-Screening',
    });
  });

  it('disables the submit button while busy', () => {
    const fields = AGENT_INPUT_SCHEMAS['ai-discovery-agent']!;
    const { getByRole } = render(<AgentRunForm fields={fields} busy onSubmit={() => {}} />);
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
