import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AiOsDashboardOverview } from '../../../../src/features/governance/dashboard/AiOsDashboardOverview';
import { computeStartPanel } from '../../../../src/features/governance/dashboard/startPanelModel';
import type { CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';

const UNKNOWN = { websiteCount: null, scanCount: null, aiSystemCount: null, activationStatus: null } as const;
const KNOWN = { websiteCount: 1, scanCount: 0, aiSystemCount: 4, activationStatus: 'none' } as const;

function mount(facts: typeof UNKNOWN | typeof KNOWN, data: CockpitData | null = null) {
  return render(
    <MemoryRouter>
      <AiOsDashboardOverview
        tenantName="Test Workspace"
        hasTenant
        facts={facts}
        model={computeStartPanel(facts)}
        data={data}
        loading={false}
        error={null}
        onRetry={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('AI-first dashboard overview', () => {
  it('never renders unknown tenant KPIs as zero', () => {
    mount(UNKNOWN);
    const metrics = screen.getByTestId('ai-dashboard-metrics');
    expect(within(metrics).getByText('Websites')).toBeInTheDocument();
    expect(screen.getByTestId('ai-metric-Websites').textContent).toBe('—');
    expect(screen.getByTestId('ai-metric-KI-Systeme').textContent).toBe('—');
    expect(screen.getByTestId('ai-metric-Governance-Score').textContent).toBe('—');
    expect(screen.getByTestId('ai-metric-Evidence').textContent).toBe('—');
    expect(screen.getByTestId('ai-metric-Offene Alerts').textContent).toBe('—');
    expect(screen.queryByTestId('ai-dashboard-next-action')).not.toBeInTheDocument();
  });

  it('shows real source-backed values and existing routes', () => {
    const data = {
      scoreStatus: 'ok', score: 78,
      partialFailures: [],
      evidenceHealth: { totalCount: 12 },
      summary24h: { open_alerts: 2 },
    } as unknown as CockpitData;
    mount(KNOWN, data);
    expect(screen.getByTestId('ai-metric-Websites').textContent).toBe('1');
    expect(screen.getByTestId('ai-metric-KI-Systeme').textContent).toBe('4');
    expect(screen.getByTestId('ai-metric-Governance-Score').textContent).toBe('78 / 100');
    expect(screen.getByTestId('ai-metric-Evidence').textContent).toBe('12');
    expect(screen.getByTestId('ai-metric-Offene Alerts').textContent).toBe('2');
    expect(screen.getByTestId('ai-dashboard-next-action').getAttribute('href')).toBe('/app/websites');
    expect(screen.getByRole('link', { name: /Alle Module/i }).getAttribute('href')).toBe('/app/modules');
  });

  it('explicitly warns on partial failure instead of inventing evidence', () => {
    const data = {
      scoreStatus: 'unavailable', score: null,
      partialFailures: ['evidence-total: failed'],
      evidenceHealth: { totalCount: 0 },
      summary24h: null,
    } as unknown as CockpitData;
    mount(KNOWN, data);
    expect(screen.getByTestId('dashboard-partial-data')).toBeInTheDocument();
    expect(screen.getByTestId('ai-metric-Evidence').textContent).toBe('—');
    expect(screen.getByTestId('ai-metric-Governance-Score').textContent).toBe('—');
  });

  it('uses the existing assistant prefill event, never triggers a direct action', () => {
    const listener = vi.fn();
    const { container } = mount(KNOWN);
    window.addEventListener('realsync:assistant-prompt', listener);
    try {
      fireEvent.change(within(container).getByRole('textbox', { name: 'Nachricht an RealSync AI' }), {
        target: { value: ' Risiken priorisieren ' },
      });
      fireEvent.click(within(container).getByRole('button', { name: 'Im Assistenten öffnen' }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0][0] as CustomEvent).detail.prompt).toBe('Risiken priorisieren');
    } finally {
      window.removeEventListener('realsync:assistant-prompt', listener);
    }
  });
});
