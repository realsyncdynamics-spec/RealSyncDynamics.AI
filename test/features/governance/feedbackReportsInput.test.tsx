/**
 * FeedbackReportsInput — verifies the reports-payload builder and that the
 * repeatable-row form collects rows and submits a { reports } payload whose
 * shape matches what the Feedback Intelligence agent consumes.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  FeedbackReportsInput,
  buildReportsPayload,
  type ReportRow,
} from '@/src/features/governance/agents/FeedbackReportsInput';

describe('buildReportsPayload', () => {
  it('maps rows to reports, dropping empty titles', () => {
    const rows: ReportRow[] = [
      { type: 'bug', severity: 'critical', title: 'Login crash' },
      { type: 'feature_request', severity: 'low', title: '   ' },
    ];
    expect(buildReportsPayload(rows)).toEqual({
      reports: [
        { type: 'bug', severity: 'critical', title: 'Login crash' },
        { type: 'feature_request', severity: 'low' },
      ],
    });
  });

  it('skips rows without a type', () => {
    const rows: ReportRow[] = [
      { type: '', severity: 'high', title: 'x' },
      { type: 'bug', severity: 'high', title: '' },
    ];
    expect(buildReportsPayload(rows)).toEqual({ reports: [{ type: 'bug', severity: 'high' }] });
  });
});

describe('FeedbackReportsInput render', () => {
  it('adds a row and submits a reports payload for each row', () => {
    const onSubmit = vi.fn();
    const { getByLabelText, getByRole } = render(
      <FeedbackReportsInput busy={false} onSubmit={onSubmit} />,
    );

    // First row: bug / critical with a title
    fireEvent.change(getByLabelText('Typ 1'), { target: { value: 'bug' } });
    fireEvent.change(getByLabelText('Schweregrad 1'), { target: { value: 'critical' } });
    fireEvent.change(getByLabelText('Titel 1'), { target: { value: 'crash on save' } });

    // Add a second row: feature_request / low
    fireEvent.click(getByRole('button', { name: /Meldung hinzufügen/ }));
    fireEvent.change(getByLabelText('Typ 2'), { target: { value: 'feature_request' } });
    fireEvent.change(getByLabelText('Schweregrad 2'), { target: { value: 'low' } });

    fireEvent.click(getByRole('button', { name: /Skill starten/ }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      reports: [
        { type: 'bug', severity: 'critical', title: 'crash on save' },
        { type: 'feature_request', severity: 'low' },
      ],
    });
  });

  it('keeps at least one row (remove is disabled for a single row)', () => {
    const { getByLabelText } = render(<FeedbackReportsInput busy={false} onSubmit={() => {}} />);
    expect((getByLabelText('Zeile 1 entfernen') as HTMLButtonElement).disabled).toBe(true);
  });
});
