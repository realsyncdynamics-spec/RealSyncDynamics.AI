/**
 * P0-1 — Score-Kachel (HandoffOverview) und Prüfer-Mappe (CeoBriefPrintView):
 * „Noch nicht bewertbar“ statt 100, Fehlerzustand mit Retry, kein Score im
 * Druck/Hash bei status ≠ ok.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';

vi.mock('../../../../src/features/governance/governanceApi', () => ({
  fetchTenantAssets: vi.fn().mockResolvedValue([]),
  fetchTenantEvidence: vi.fn().mockResolvedValue([]),
  fetchTenantPolicies: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../src/features/governance/gatesApi', () => ({ listConnectors: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../../src/features/policy-packs/policyPacksApi', () => ({ listTenantMappings: vi.fn().mockResolvedValue([]) }));

const brief = vi.hoisted(() => ({ data: null as CockpitData | null }));
vi.mock('../../../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 't1', tenants: [{ tenantId: 't1', name: 'Acme GmbH' }] }),
}));
vi.mock('../../../../src/features/governance/cockpit/cockpitData', async (orig) => {
  const actual = await orig<typeof import('../../../../src/features/governance/cockpit/cockpitData')>();
  return { ...actual, loadCockpitData: vi.fn(async () => brief.data) };
});

import { HandoffOverview } from '../../../../src/features/governance/handoff/HandoffOverview';
import { CeoBriefPrintView } from '../../../../src/features/governance/cockpit/CeoBriefPrintView';
import { cockpitIntegrityHash } from '../../../../src/features/governance/cockpit/cockpitData';

function cockpit(overrides: Partial<CockpitData> = {}): CockpitData {
  return {
    counts: { incidents: 0, dpias: 0, dsr: { total: 0, overdue: 0 }, approvals: 0, vendorsNoDpa: 0 },
    posture: null,
    score: null,
    scoreStatus: 'insufficient_data',
    scoreBasis: { aiSystems: 0, controlMappings: 0 },
    readiness: null,
    readinessTrend: null,
    actions: [],
    lastUpdated: null,
    evidenceHealth: { percent: null, label: 'Keine Evidence-Abdeckung', totalCount: 1, hashedCount: 1 } as CockpitData['evidenceHealth'],
    riskIndex: { score: 20, level: 'low', label: 'Gering', assetCount: 2, highRiskAssets: 0, newRisks24h: 0 } as CockpitData['riskIndex'],
    openMeasures: { total: 0 } as CockpitData['openMeasures'],
    summary24h: null,
    recentEvents: [],
    riskDistribution: [],
    assetFlows: [],
    partialFailures: [],
    ...overrides,
  };
}

function renderTile(props: Partial<Parameters<typeof HandoffOverview>[0]>) {
  return render(
    <MemoryRouter>
      <HandoffOverview activeTenantId="t1" data={null} {...props} />
    </MemoryRouter>,
  );
}

describe('Score-Kachel (HandoffOverview)', () => {
  it('leerer Mandant ⇒ „Noch nicht bewertbar“ + erster Schritt, keine 100', async () => {
    renderTile({ data: cockpit() });
    const tile = screen.getByTestId('overview-score');
    expect(tile.textContent).toContain('Noch nicht bewertbar');
    expect(screen.queryByTestId('overview-score-value')).toBeNull();
    expect(tile.textContent).not.toMatch(/\b100\b/);
    expect(screen.getByTestId('overview-score-state-first-step')).toHaveAttribute('href', '/app/onboarding');
  });

  it('Ladefehler ⇒ Fehlerzustand mit Retry, kein Leerzustand', () => {
    const onRetry = vi.fn();
    renderTile({ data: null, error: 'network', onRetry });
    expect(screen.getByTestId('overview-score-state-error').textContent).toContain('Score konnte nicht geladen werden');
    expect(screen.queryByText('Noch nicht bewertbar')).toBeNull();
    fireEvent.click(screen.getByTestId('overview-score-state-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('unreliable (Teilquelle fehlgeschlagen) ⇒ Fehlerzustand', () => {
    renderTile({ data: cockpit({ scoreStatus: 'unreliable', partialFailures: ['kpi: rpc down'] }) });
    expect(screen.getByTestId('overview-score-state-error')).toBeInTheDocument();
  });

  it('ok ⇒ Zahl', () => {
    renderTile({ data: cockpit({ scoreStatus: 'ok', score: 74, scoreBasis: { aiSystems: 1, controlMappings: 2 } }) });
    expect(screen.getByTestId('overview-score-value').textContent).toBe('74');
  });
});

describe('Prüfer-Mappe (CeoBriefPrintView)', () => {
  beforeEach(() => {
    vi.spyOn(window, 'print').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('druckt „Noch nicht bewertbar“ statt 100/100 und hasht keinen Score', async () => {
    brief.data = cockpit();
    render(<CeoBriefPrintView />);
    const score = await screen.findByTestId('brief-score');
    expect(score.textContent).toContain('Noch nicht bewertbar');
    expect(score.textContent).not.toMatch(/\/100|Sehr gut/);
    const generatedDate = new Date().toISOString().slice(0, 10);
    const expected = await cockpitIntegrityHash(brief.data, generatedDate);
    await waitFor(() => expect(screen.getByTestId('brief-hash').textContent).toBe(expected));
    // Selbst ein untergeschobener Score ändert den Hash nicht.
    expect(await cockpitIntegrityHash({ ...brief.data, score: 100 }, generatedDate)).toBe(expected);
    expect(screen.getByTestId('ceo-brief').textContent).toContain('kein Score im Hash');
  });

  it('unreliable ⇒ kein automatischer Druckdialog, „Erneut laden“ vorhanden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    brief.data = cockpit({ scoreStatus: 'unreliable', partialFailures: ['incidents: RLS'] });
    render(<CeoBriefPrintView />);
    await screen.findByTestId('brief-score');
    vi.advanceTimersByTime(1000);
    expect(window.print).not.toHaveBeenCalled();
    expect(screen.getByText('Erneut laden')).toBeInTheDocument();
    expect(screen.getByTestId('ceo-brief').textContent).toContain('nicht geladen');
    vi.useRealTimers();
  });

  it('ok ⇒ Score mit Label', async () => {
    brief.data = cockpit({ scoreStatus: 'ok', score: 74, scoreBasis: { aiSystems: 1, controlMappings: 2 } });
    render(<CeoBriefPrintView />);
    const score = await screen.findByTestId('brief-score');
    expect(score.textContent).toContain('74/100');
  });
});

describe('„Braucht Aufmerksamkeit“ (Addendum P0-3)', () => {
  const finding = (resolvedAt: string | null) => ({
    id: 'f1', title: 'DMARC fehlt', level: 'medium' as const, eventType: 'email_auth_finding',
    source: 'website_scanner', createdAt: '2026-06-27T23:02:04Z', assetId: null, resolvedAt,
  });

  it('erhöhtes Asset + offener Befund ⇒ Einträge statt „Nichts offen“', async () => {
    render(
      <MemoryRouter>
        <HandoffOverview
          activeTenantId="t1"
          data={cockpit({
            signals: {
              elevatedAssets: [{ id: 'w1', name: 'realsyncdynamicsai.de', score: 68, bucket: 'high' }],
              findings: [finding(null)],
              lastScanAt: null,
              latestEvidenceAt: null,
            },
          })}
        />
      </MemoryRouter>,
    );
    const items = await screen.findAllByTestId('attention-item');
    const text = items.map((i) => i.textContent).join(' | ');
    expect(text).toContain('realsyncdynamicsai.de');
    expect(text).toContain('DMARC fehlt');
    expect(screen.queryByTestId('attention-empty')).toBeNull();
  });

  it('behobener Befund, keine erhöhten Assets ⇒ „Nichts offen“', async () => {
    render(
      <MemoryRouter>
        <HandoffOverview
          activeTenantId="t1"
          data={cockpit({
            signals: { elevatedAssets: [], findings: [finding('2026-09-20T08:00:00Z')], lastScanAt: null, latestEvidenceAt: null },
          })}
        />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('attention-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('attention-item')).toBeNull();
  });

  it('Posture nicht gemessen ⇒ eigener Hinweis statt „kein Snapshot“', async () => {
    renderTile({
      data: cockpit({ postureStatus: 'not_measured', scoreBasis: { aiSystems: 2, controlMappings: 0 } }),
    });
    const state = await screen.findByTestId('overview-score-state-empty');
    expect(state.textContent).toContain('noch nicht gemessen');
  });
});

describe('„Braucht Aufmerksamkeit“ — Leerzustände ohne positive Aussage aus fehlenden Daten', () => {
  const noSignals = { elevatedAssets: [], findings: [], lastScanAt: null, latestEvidenceAt: null };

  function renderAttention(data: CockpitData, extra: Partial<Parameters<typeof HandoffOverview>[0]> = {}) {
    return render(
      <MemoryRouter>
        <HandoffOverview activeTenantId="t1" data={data} {...extra} />
      </MemoryRouter>,
    );
  }

  it('leerer Workspace ⇒ „Noch nichts zu bewerten“ mit Einstiegen, nie „Nichts offen“', async () => {
    renderAttention(cockpit({ signals: noSignals }));
    const box = await screen.findByTestId('attention-nodata');
    expect(box.textContent).toContain('Noch nichts zu bewerten');
    // Die Score-Karte trägt denselben Einstieg — deshalb im Kasten suchen.
    expect(within(box).getByRole('link', { name: /Erstes KI-System erfassen/ })).toHaveAttribute('href', '/app/onboarding');
    expect(within(box).getByRole('link', { name: /Website-Audit starten/ })).toHaveAttribute('href', '/app/websites');
    expect(screen.queryByTestId('attention-empty')).toBeNull();
  });

  it('Befund-Quelle fehlgeschlagen ⇒ keine Aussage statt „Nichts offen“', async () => {
    renderAttention(cockpit({
      signals: { ...noSignals, lastScanAt: '2026-09-01T10:00:00Z' },
      partialFailures: ['findings-table: rls'],
    }));
    expect(await screen.findByTestId('attention-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('attention-empty')).toBeNull();
    expect(screen.queryByTestId('attention-nodata')).toBeNull();
  });

  it('Cockpit-Ladefehler ⇒ keine Aussage', async () => {
    renderAttention(cockpit({ signals: { ...noSignals, lastScanAt: '2026-09-01T10:00:00Z' } }), { error: 'boom' });
    expect(await screen.findByTestId('attention-unavailable')).toBeInTheDocument();
  });

  it('Audit gelaufen, alles geladen, nichts offen ⇒ „Nichts offen“', async () => {
    renderAttention(cockpit({ signals: { ...noSignals, lastScanAt: '2026-09-01T10:00:00Z' } }));
    expect(await screen.findByTestId('attention-empty')).toBeInTheDocument();
  });

  it('nur offene Befunde niedriger Stufe ⇒ Hinweis mit Anzahl statt „Nichts offen“', async () => {
    renderAttention(cockpit({
      signals: {
        ...noSignals,
        lastScanAt: '2026-09-01T10:00:00Z',
        findings: [{
          id: 'fl', title: 'Info-Header fehlt', level: 'low', eventType: 'finding', source: 'gdpr-audit',
          createdAt: '2026-09-26T10:00:00Z', assetId: null, resolvedAt: null, href: '/app/scans/run-1',
        }],
      },
    }));
    const box = await screen.findByTestId('attention-minor');
    expect(box.textContent).toContain('1 offene Befunde niedriger Stufe');
    expect(screen.queryByTestId('attention-empty')).toBeNull();
  });

  it('offener Befund aus dem Website-Audit ⇒ Eintrag mit Link auf den Scan', async () => {
    renderAttention(cockpit({
      signals: {
        ...noSignals,
        lastScanAt: '2026-09-01T10:00:00Z',
        findings: [{
          id: 'fx1', title: 'Kein Cookie-Banner', level: 'high', eventType: 'finding', source: 'gdpr-audit',
          createdAt: '2026-09-26T10:00:00Z', assetId: null, resolvedAt: null, href: '/app/scans/run-1',
        }],
      },
    }));
    const [item] = await screen.findAllByTestId('attention-item');
    expect(item.textContent).toContain('Kein Cookie-Banner');
    expect(item).toHaveAttribute('href', '/app/scans/run-1');
  });
});
