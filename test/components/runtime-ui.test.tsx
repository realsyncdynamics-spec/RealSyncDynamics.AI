import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  RuntimeKpiCard,
  RuntimeLogStream,
  RuntimeStatusBadge,
  RuntimeTelemetryBar,
  severityToTone,
} from '../../src/components/runtime-ui';
import { RUNTIME_DEMO_OVERVIEW } from '../../src/lib/runtime/runtimeDemoData';
import { EvidenceBox } from '../../src/features/audit/EvidenceBox';

describe('runtime-ui primitives', () => {
  it('rendert KPI mit Demo-Label und Wert', () => {
    const kpi = RUNTIME_DEMO_OVERVIEW.kpis[0];
    render(<RuntimeKpiCard kpi={kpi} />);
    expect(screen.getByText(kpi.label)).toBeInTheDocument();
    expect(screen.getByText(kpi.value)).toBeInTheDocument();
    expect(screen.getByText(/Demo/i)).toBeInTheDocument();
  });

  it('Telemetry-Bar zeigt Demo-Status und Quelle', () => {
    render(<RuntimeTelemetryBar source="test.source" state="demo" />);
    expect(screen.getByText(/Demo-Telemetrie/i)).toBeInTheDocument();
    expect(screen.getByText(/test.source/)).toBeInTheDocument();
  });

  it('Log-Stream rendert alle Eintraege', () => {
    render(<RuntimeLogStream entries={RUNTIME_DEMO_OVERVIEW.log} live={false} />);
    expect(screen.getByText(/Pausiert/i)).toBeInTheDocument();
    RUNTIME_DEMO_OVERVIEW.log.forEach((entry) => {
      expect(screen.getByText(new RegExp(entry.message.split(' ·')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
    });
  });

  it('Status-Badge mit live-Flag setzt Pulse-Klasse', () => {
    const { container } = render(<RuntimeStatusBadge label="Live" tone="cyan" live />);
    expect(container.querySelector('.rt-live-dot')).not.toBeNull();
  });

  it('severityToTone mapped severities deterministisch', () => {
    expect(severityToTone('critical')).toBe('danger');
    expect(severityToTone('high')).toBe('danger');
    expect(severityToTone('medium')).toBe('warn');
    expect(severityToTone('low')).toBe('info');
    expect(severityToTone('info')).toBe('neutral');
  });
});

describe('EvidenceBox', () => {
  it('zeigt Pflichtfelder und Disclaimer', () => {
    render(
      <MemoryRouter>
        <EvidenceBox
          finding={{
            severity:       'high',
            title:          'Tracker vor Einwilligung erkannt',
            description:    'Beispielbeschreibung.',
            rule_id:        'consent.pre_consent_tracker',
            rule_version:   '1.2.0',
            detected_at:    '2026-05-19T20:41:02.000Z',
            source_url:     'https://www.example.com/',
            evidence_hash:  'sha256:abcd…1234',
            confidence:     0.86,
            fix_snippet_id: 'fix.snippet.csp_block_ga',
            review_status:  'review_required',
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Tracker vor Einwilligung erkannt')).toBeInTheDocument();
    expect(screen.getByText('consent.pre_consent_tracker')).toBeInTheDocument();
    expect(screen.getByText('sha256:abcd…1234')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText(/Human Review/i)).toBeInTheDocument();
  });
});
