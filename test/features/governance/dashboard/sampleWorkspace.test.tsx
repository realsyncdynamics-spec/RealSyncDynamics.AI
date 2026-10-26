/**
 * WP-4 Beispielansicht (/app/beispiel): erfundene Daten, klar markiert,
 * ohne einen einzigen Datenbankaufruf — und in sich stimmig, weil sie durch
 * dieselben Rechenfunktionen laufen wie loadCockpitData.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../src/lib/supabase', async (orig) => ({
  ...(await orig<typeof import('../../../../src/lib/supabase')>()),
  getSupabase: vi.fn(() => {
    throw new Error('Beispielansicht darf keine Datenbank lesen');
  }),
}));

import { getSupabase } from '../../../../src/lib/supabase';
import {
  SAMPLE_DOMAIN,
  SAMPLE_TENANT_NAME,
  buildSampleCockpitData,
  buildSampleComplianceKpi,
  buildSampleStartFacts,
} from '../../../../src/features/governance/dashboard/sampleWorkspace';
import { computeStartPanel } from '../../../../src/features/governance/dashboard/startPanelModel';
import { SampleWorkspacePage } from '../../../../src/features/governance/dashboard/SampleWorkspacePage';
import { ComplianceStatusView } from '../../../../src/features/governance/dashboard/ComplianceStatusDashboard';

const NOW = Date.parse('2026-10-25T12:00:00Z');

describe('Beispieldaten', () => {
  it('ergeben einen bewertbaren Score ohne Teilausfälle', () => {
    const data = buildSampleCockpitData(NOW);
    expect(data.scoreStatus).toBe('ok');
    expect(typeof data.score).toBe('number');
    expect(data.partialFailures).toEqual([]);
    expect(data.postureStatus).toBe('measured');
    expect(data.readiness).toBe(58);
  });

  it('sind in sich stimmig: Verteilung, Flows und Risiko-Index zählen dieselben Assets', () => {
    const data = buildSampleCockpitData(NOW);
    const distributed = data.riskDistribution.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(distributed).toBe(data.riskIndex.assetCount);
    const aiFlow = data.assetFlows.find((flow) => flow.type === 'ai_system');
    expect(aiFlow?.count).toBe(data.scoreBasis.aiSystems);
    expect(data.openMeasures.total).toBeGreaterThan(0);
    expect(data.actions.length).toBeGreaterThan(0);
  });

  it('sind fest: gleicher Zeitpunkt, gleiche Daten', () => {
    expect(buildSampleCockpitData(NOW)).toEqual(buildSampleCockpitData(NOW));
    expect(buildSampleComplianceKpi(NOW)).toEqual(buildSampleComplianceKpi(NOW));
  });

  it('nutzen eine reservierte Domain und einen als Beispiel benannten Mandanten', () => {
    expect(SAMPLE_DOMAIN.endsWith('.example')).toBe(true);
    expect(SAMPLE_TENANT_NAME).toContain('Beispiel');
  });

  it('zeigen eine fertig eingerichtete Startansicht', () => {
    const model = computeStartPanel(buildSampleStartFacts(buildSampleCockpitData(NOW)));
    expect(model.complete).toBe(true);
    expect(model.pending).toBe(false);
  });
});

describe('SampleWorkspacePage', () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/app/beispiel']}>
        <SampleWorkspacePage />
      </MemoryRouter>,
    );
  }

  it('kennzeichnet die Daten als erfunden und führt zurück zum eigenen Workspace', () => {
    renderPage();
    expect(screen.getByTestId('sample-banner').textContent).toContain('Erfundenes Unternehmen');
    expect(screen.getByTestId('sample-back').getAttribute('href')).toBe('/app/dashboard');
    expect(screen.getByText(/erfundene Beispieldaten, nicht aus Ihrem Workspace/)).toBeInTheDocument();
    expect(screen.queryByText(/aus Ihren Mandantendaten/)).toBeNull();
  });

  it('zeigt Startansicht und Cockpit mit Werten', () => {
    renderPage();
    expect(screen.getByTestId('customer-start')).toBeInTheDocument();
    expect(screen.getByTestId('governance-score')).toBeInTheDocument();
    expect(screen.getByTestId('risk-distribution')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-tenant-cta')).toBeNull();
    expect(screen.getByTestId('customer-start').textContent).toContain(SAMPLE_TENANT_NAME);
    expect(screen.getByTestId('compliance-status-dashboard').textContent).toContain(`Status · ${SAMPLE_TENANT_NAME}`);
  });

  it('bietet keine Prüfer-Mappe an und liest nichts aus der Datenbank', () => {
    renderPage();
    expect(screen.queryByText('Prüfer-Mappe')).toBeNull();
    expect(vi.mocked(getSupabase)).not.toHaveBeenCalled();
  });
});

describe('ComplianceStatusView ohne Beispiel-Schalter', () => {
  it('behält Untertitel und Prüfer-Mappe für echte Mandanten', () => {
    render(
      <MemoryRouter>
        <ComplianceStatusView
          tenantName="Acme GmbH"
          activeTenantId="tenant-1"
          data={buildSampleCockpitData(NOW)}
          loading={false}
          error={null}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/aus Ihren Mandantendaten/)).toBeInTheDocument();
    expect(screen.getByText('Prüfer-Mappe')).toBeInTheDocument();
  });
});

describe('Einstieg und Route', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const command = readFileSync('src/features/governance/dashboard/CommandCenterDashboard.tsx', 'utf8');

  it('/app/beispiel liegt im App-Rahmen hinter AppGate', () => {
    expect(app).toContain(
      '<Route path="/app/beispiel" element={<AppGate><GovernanceBrowserShell><SampleWorkspacePage /></GovernanceBrowserShell></AppGate>} />',
    );
  });

  it('das Dashboard verlinkt die Beispielansicht nur bei offenen Einrichtungsschritten', () => {
    expect(command).toContain('to="/app/beispiel"');
    expect(command).toContain("startModel.steps.some((step) => step.state === 'open')");
  });
});
