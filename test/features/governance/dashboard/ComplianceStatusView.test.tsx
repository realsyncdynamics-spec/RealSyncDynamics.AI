import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComplianceStatusView } from '../../../../src/features/governance/dashboard/ComplianceStatusDashboard';
import type { CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';
import {
  computeEvidenceHealth,
  computeOpenMeasures,
  computeRiskDistribution,
  computeRiskIndex,
  EMPTY_SUMMARY_24H,
} from '../../../../src/features/governance/dashboard/complianceStatus';
import { computeAuditReadiness, computeGovernanceScore, type CockpitCounts } from '../../../../src/features/governance/cockpit/cockpitScore';

const ZERO: CockpitCounts = {
  incidents: 0,
  dpias: 0,
  dsr: { total: 0, overdue: 0 },
  approvals: 0,
  vendorsNoDpa: 0,
};

function fixture(overrides: Partial<CockpitData> = {}): CockpitData {
  const counts: CockpitCounts = overrides.counts ?? ZERO;
  const posture = overrides.posture === undefined ? null : overrides.posture;
  const evidenceHealth = overrides.evidenceHealth ?? computeEvidenceHealth({
    coveragePercent: posture?.assetEvidencePercent ?? null,
    evidence: [],
    newEvidence24h: 0,
    failedScans: 0,
  });
  const riskIndex = overrides.riskIndex ?? computeRiskIndex({
    assetScores: [],
    newRisks24h: 0,
    openIncidents: counts.incidents,
    dsrOverdue: counts.dsr.overdue,
  });
  return {
    counts,
    posture,
    score: overrides.score !== undefined ? overrides.score : computeGovernanceScore(counts, posture),
    scoreStatus: overrides.scoreStatus ?? 'ok',
    scoreBasis: overrides.scoreBasis ?? { aiSystems: 1, controlMappings: 1 },
    readiness: overrides.readiness !== undefined ? overrides.readiness : computeAuditReadiness(posture),
    readinessTrend: overrides.readinessTrend ?? null,
    actions: overrides.actions ?? [],
    lastUpdated: overrides.lastUpdated ?? null,
    evidenceHealth,
    riskIndex,
    openMeasures: overrides.openMeasures ?? computeOpenMeasures(counts),
    summary24h: overrides.summary24h === undefined ? null : overrides.summary24h,
    recentEvents: overrides.recentEvents ?? [],
    riskDistribution: overrides.riskDistribution ?? [
      { id: 'critical', label: 'Kritisch', count: 0 },
      { id: 'high', label: 'Hoch', count: 0 },
      { id: 'medium', label: 'Mittel', count: 0 },
      { id: 'low', label: 'Gering', count: 0 },
      { id: 'passed', label: 'Stabil', count: 0 },
    ],
    assetFlows: overrides.assetFlows ?? [],
    partialFailures: overrides.partialFailures ?? [],
    signals: overrides.signals,
  };
}

function rendered(
  props: Partial<Parameters<typeof ComplianceStatusView>[0]> = {},
  initialEntry = '/app/dashboard',
) {
  const result = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ComplianceStatusView
        tenantName="Acme GmbH"
        activeTenantId="tenant-1"
        data={null}
        loading={false}
        error={null}
        {...props}
      />
    </MemoryRouter>,
  );
  return result;
}

describe('ComplianceStatusView', () => {
  it('renders the live status surface, not a chat composer', () => {
    const { getByTestId, queryByPlaceholderText, getByText } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        score: 90,
        riskIndex: computeRiskIndex({
          assetScores: [40],
          newRisks24h: 0,
          openIncidents: 1,
          dsrOverdue: 0,
        }),
      }),
    });
    expect(getByTestId('compliance-status-dashboard')).toBeInTheDocument();
    expect(getByTestId('governance-score')).toBeInTheDocument();
    expect(getByTestId('risk-index')).toBeInTheDocument();
    expect(getByTestId('evidence-health')).toBeInTheDocument();
    expect(getByTestId('audit-readiness')).toBeInTheDocument();
    expect(getByTestId('open-measures')).toBeInTheDocument();
    expect(getByTestId('runtime-event-stream')).toBeInTheDocument();
    expect(getByTestId('risk-distribution')).toBeInTheDocument();
    expect(getByTestId('asset-flows')).toBeInTheDocument();
    expect(getByTestId('policy-coverage')).toBeInTheDocument();
    expect(getByTestId('critical-findings')).toBeInTheDocument();
    expect(getByTestId('framework-strip')).toBeInTheDocument();
    expect(getByText('Status · Acme GmbH')).toBeInTheDocument();
    expect(getByText('Governance Command Center')).toBeInTheDocument();
    expect(queryByPlaceholderText(/nachricht/i)).toBeNull();
  });

  it('shows dashes instead of fake scores when the tenant is empty', () => {
    const { getByText, queryByTestId, getByTestId } = rendered({
      data: fixture({ score: null, scoreStatus: 'insufficient_data', scoreBasis: { aiSystems: 0, controlMappings: 0 } }),
    });
    expect(getByText('Noch keine Governance-Daten')).toBeInTheDocument();
    expect(queryByTestId('governance-score')).toBeNull();
    expect(queryByTestId('risk-index')).toBeNull();
    expect(queryByTestId('evidence-health')).toBeNull();
    expect(queryByTestId('open-measures')).toBeNull();
    // Compliance KPI row still renders — Governance-Score aus derselben
    // Quelle wie Kachel/Karte: „Noch nicht bewertbar“, nie 100.
    expect(getByTestId('compliance-kpi-row')).toBeInTheDocument();
    expect(getByTestId('compliance-score-overall').textContent).toContain('Noch nicht bewertbar');
    expect(getByTestId('compliance-score-overall').textContent).not.toMatch(/\b100\b/);
    expect(getByTestId('compliance-critical-findings').textContent).toContain('—');
  });

  it('renders measured compliance KPIs including valid zero', () => {
    const { getByTestId } = rendered({
      data: fixture({ counts: { ...ZERO, incidents: 1 } }),
      complianceKpi: {
        score_overall: 0,
        score_breakdown: {
          score_gdpr: 0,
          score_nis2: null,
          score_dsa: null,
          score_ai_act: null,
          policy_compliance: null,
          vendor_risk: null,
          incident_response: null,
          data_governance: null,
        },
        riskTrendDirection: 'stable',
        criticalFindings: 0,
        newIncidents: 0,
        resolvedIncidents: null,
        upcomingDeadlines: null,
        policies: { documented: null, pending: null },
        vendors: { active: null, highRisk: null },
      },
    });
    // P0: Score overall = Governance-Score (90 aus 1 Vorfall), die
    // compliance_score_history nur noch als Rahmenwerk-Hinweis.
    expect(getByTestId('compliance-score-overall').textContent).toContain('Governance-Score90');
    expect(getByTestId('compliance-score-overall').textContent).toContain('Rahmenwerk-Historie: GDPR 0');
    expect(getByTestId('governance-score').textContent).toContain('90');
    expect(getByTestId('compliance-critical-findings').textContent).toContain('Critical findings0');
    expect(getByTestId('compliance-new-incidents').textContent).toContain('New incidents (24h)0');
    expect(getByTestId('compliance-risk-trend').textContent).toMatch(/Stable/);
  });

  it('does not treat a partial load failure as an empty tenant', () => {
    const { getByTestId, queryByText } = rendered({
      data: fixture({
        partialFailures: ['incidents: RLS'],
        score: null,
        scoreStatus: 'unreliable',
      }),
    });
    expect(getByTestId('compliance-partial-failure')).toBeInTheDocument();
    expect(queryByText('Noch keine Governance-Daten')).toBeNull();
    // Fehlerzustand mit Retry — weder Leerzustand noch Zahl.
    expect(getByTestId('governance-score-state-error').textContent).toContain('Score konnte nicht geladen werden');
    expect(getByTestId('governance-score-state-retry')).toBeInTheDocument();
    expect(queryByText('Noch nicht bewertbar')).toBeNull();
    expect(getByTestId('governance-score').textContent).not.toMatch(/Sehr gut|100/);
  });

  it('calls onRetry from the score error state', () => {
    const onRetry = vi.fn();
    const { getByTestId } = rendered({
      data: fixture({ partialFailures: ['kpi: rpc down'], score: null, scoreStatus: 'unreliable' }),
      onRetry,
    });
    fireEvent.click(getByTestId('governance-score-state-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('P0-2: „Packs →“ trägt ein Schloss, wenn policy.packs fehlt (Free)', () => {
    const { getByTestId, unmount } = rendered({
      data: fixture({ counts: { ...ZERO, incidents: 1 } }),
      packsLockTitle: 'Policy Packs — ab Starter',
    });
    const link = getByTestId('policy-coverage-packs-link');
    expect(link).toHaveAttribute('data-locked', 'true');
    expect(link).toHaveAttribute('title', 'Policy Packs — ab Starter');
    expect(link.querySelector('svg')).not.toBeNull();
    unmount();
    const open = rendered({ data: fixture({ counts: { ...ZERO, incidents: 1 } }) });
    const openLink = open.getByTestId('policy-coverage-packs-link');
    expect(openLink).toHaveAttribute('data-locked', 'false');
    expect(openLink.querySelector('svg')).toBeNull();
  });

  it('Addendum: ein Score-Wert auf allen Flächen — insufficient_data ⇒ KPI-Zeile und Karte „Noch nicht bewertbar“', () => {
    const { getByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        score: null,
        scoreStatus: 'insufficient_data',
        scoreBasis: { aiSystems: 0, controlMappings: 0 },
      }),
    });
    expect(getByTestId('compliance-score-overall').textContent).toContain('Noch nicht bewertbar');
    expect(getByTestId('governance-score').textContent).toContain('Noch nicht bewertbar');
    expect(getByTestId('compliance-score-overall').textContent).not.toMatch(/\b100\b/);
    expect(getByTestId('governance-score').textContent).not.toMatch(/\b100\b/);
  });

  it('Addendum: Residualrisiko nennt Hoch/Kritisch mit derselben Schwelle wie die Verteilung', () => {
    const { getByTestId } = rendered({
      data: fixture({
        riskIndex: computeRiskIndex({ assetScores: [68, 0], newRisks24h: 0, openIncidents: 0, dsrOverdue: 0 }),
        riskDistribution: computeRiskDistribution([68, 0]),
      }),
    });
    expect(getByTestId('risk-index').textContent).toContain('1 Hoch/Kritisch (≥ 50)');
    expect(getByTestId('risk-index-explainer').textContent).toMatch(/Mittelwert/);
  });

  it('Addendum: Kritische Befunde enthalten erhöhte Assets, mittlere Scanner-Befunde als Hinweis mit Alter', () => {
    const { getByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        signals: {
          elevatedAssets: [{ id: 'w1', name: 'realsyncdynamicsai.de', score: 68, bucket: 'high' }],
          findings: [{
            id: 'f1', title: 'DMARC fehlt', level: 'medium', eventType: 'email_auth_finding',
            source: 'website_scanner', createdAt: new Date(Date.now() - 89 * 86_400_000).toISOString(),
            assetId: null, resolvedAt: null,
          }],
          lastScanAt: null,
          latestEvidenceAt: null,
        },
      }),
    });
    expect(getByTestId('critical-findings-list').textContent).toContain('realsyncdynamicsai.de');
    expect(getByTestId('medium-findings-hint').textContent).toMatch(/1 mittlerer Befund: DMARC fehlt · mittel · vor 89 Tagen/);
  });

  it('Addendum: behobener Befund (gepaart) zählt nicht und steht im Stream als „behoben“', () => {
    const { getByTestId, queryByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        recentEvents: [
          { id: 'r1', title: 'DMARC gesetzt', eventType: 'email_auth_resolved', riskLevel: 'info', source: 'website_scanner', createdAt: '2026-09-20T08:00:00Z', resolvesEventId: 'f1' },
          { id: 'f1', title: 'DMARC fehlt', eventType: 'email_auth_finding', riskLevel: 'medium', source: 'website_scanner', createdAt: '2026-06-27T23:02:04Z', resolvedAt: '2026-09-20T08:00:00Z' },
          { id: 'f0', title: 'SPF fehlt', eventType: 'email_auth_finding', riskLevel: 'medium', source: 'website_scanner', createdAt: '2026-06-27T23:02:04Z', resolvedAt: '2026-09-25T21:04:48Z', resolvedManually: true },
        ],
        signals: {
          elevatedAssets: [],
          findings: [{
            id: 'f1', title: 'DMARC fehlt', level: 'medium', eventType: 'email_auth_finding',
            source: 'website_scanner', createdAt: '2026-06-27T23:02:04Z', assetId: null,
            resolvedAt: '2026-09-20T08:00:00Z',
          }],
          lastScanAt: null,
          latestEvidenceAt: null,
        },
      }),
    });
    expect(getByTestId('event-f1')).toHaveAttribute('data-resolved', 'true');
    expect(getByTestId('event-f1-resolved').textContent).toBe('behoben am 20.09.');
    expect(getByTestId('event-f0-resolved').textContent).toBe('behoben am 25.09. · manuell bestätigt');
    expect(getByTestId('event-r1')).toHaveAttribute('data-resolved', 'false');
    expect(queryByTestId('medium-findings-hint')).toBeNull();
    expect(getByTestId('no-critical-findings')).toBeInTheDocument();
  });

  it('Addendum: Evidence mit einem 89 Tage alten Eintrag ⇒ „Zu wenig Daten“, kein 100', () => {
    const { getByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        evidenceHealth: computeEvidenceHealth({
          coveragePercent: null, totalCount: 1, hashedCount: 1, newEvidence24h: 0, failedScans: 0,
          latestEvidenceAt: new Date(Date.now() - 89 * 86_400_000).toISOString(),
        }),
      }),
    });
    const card = getByTestId('evidence-health');
    expect(card.textContent).toContain('Zu wenig Daten');
    expect(card.textContent).not.toContain('Prüfbar');
    expect(getByTestId('evidence-freshness').textContent).toBe('Unter 3 Nachweisen kein Wert. Letzter Nachweis vor 89 Tagen.');
  });

  it('shows „Noch nicht bewertbar“ with a first step instead of 100 for an empty inventory', () => {
    const { getByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO },
        score: null,
        scoreStatus: 'insufficient_data',
        scoreBasis: { aiSystems: 0, controlMappings: 0 },
        riskIndex: computeRiskIndex({ assetScores: [10, 20], newRisks24h: 0, openIncidents: 0, dsrOverdue: 0 }),
      }),
    });
    const card = getByTestId('governance-score');
    expect(card.textContent).toContain('Noch nicht bewertbar');
    expect(card.textContent).not.toMatch(/100|Sehr gut/);
    expect(getByTestId('governance-score-state-first-step')).toHaveAttribute('href', '/app/onboarding');
  });

  it('explains a missing KPI snapshot without a first-step link when the inventory has data', () => {
    const { getByTestId, queryByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        score: null,
        scoreStatus: 'insufficient_data',
        scoreBasis: { aiSystems: 2, controlMappings: 0 },
      }),
    });
    expect(getByTestId('governance-score').textContent).toContain('Noch nicht bewertbar');
    expect(getByTestId('governance-score').textContent).toContain('KPI-Snapshot');
    expect(queryByTestId('governance-score-state-first-step')).toBeNull();
  });

  it('lists prioritized open measures with deep links', () => {
    const { getByTestId, getByText } = rendered({
      data: fixture({
        counts: { incidents: 1, dpias: 0, dsr: { total: 1, overdue: 1 }, approvals: 0, vendorsNoDpa: 0 },
        actions: [{
          id: 'inc-1',
          kind: 'incident',
          title: 'Datenleck im CRM',
          detail: 'Meldefrist (72 h): 4 h überfällig',
          level: 'critical',
          deadline: '2026-09-09T10:00:00Z',
          hoursRemaining: -4,
          href: '/app/incidents',
          weight: 160,
        }],
      }),
    });
    expect(getByTestId('priority-actions').textContent).toContain('Datenleck im CRM');
    expect(getByText('Vorfälle').closest('a')).toHaveAttribute('href', '/app/incidents');
    expect(getByText('DSR überfällig').closest('a')).toHaveAttribute('href', '/app/dsr');
  });

  it('shows 24h summary only when the RPC returned data', () => {
    const withSummary = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        summary24h: { ...EMPTY_SUMMARY_24H, new_risks: 2, failed_scans: 1 },
      }),
    });
    expect(withSummary.getByTestId('summary-24h').textContent).toContain('Neue Risiken');
    withSummary.unmount();

    const without = rendered({
      data: fixture({ counts: { ...ZERO, incidents: 1 }, summary24h: null }),
    });
    expect(without.queryByTestId('summary-24h')).toBeNull();
  });

  it('asks for login when no tenant is active', () => {
    const { getByText } = rendered({
      tenantName: null,
      activeTenantId: null,
      data: null,
    });
    expect(getByText(/Workspace fehlt oder wird noch geladen/)).toBeInTheDocument();
  });

  it('surfaces loader and error without inventing metrics', () => {
    const loading = rendered({ loading: true, data: null });
    expect(loading.getByText(/wird geladen/)).toBeInTheDocument();
    loading.unmount();

    const failed = rendered({ error: 'RPC timeout', data: null });
    expect(failed.getByText('RPC timeout')).toBeInTheDocument();
    expect(failed.queryByTestId('governance-score')).toBeNull();
  });

  it('shows honest empty states for missing stream, coverage and alerts', () => {
    const { getByTestId, getByText } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        recentEvents: [],
        assetFlows: [],
        posture: null,
        summary24h: null,
      }),
    });
    expect(getByTestId('runtime-event-stream').textContent).toMatch(/Keine Runtime-Events/);
    expect(getByTestId('policy-coverage').textContent).toMatch(/KPI-Snapshot fehlt/);
    expect(getByTestId('alerts-rail').textContent).toMatch(/24h-Summary/);
    expect(getByText('DSGVO')).toBeInTheDocument();
    expect(getByText('TISAX')).toBeInTheDocument();
    expect(getByText('DORA')).toBeInTheDocument();
  });

  it('renders real runtime events and asset flows when provided', () => {
    const { getByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        recentEvents: [{
          id: 'ev-1',
          title: 'Policy-Warnung Cookie-Banner',
          eventType: 'policy_violation',
          riskLevel: 'high',
          source: 'website_scanner',
          createdAt: new Date().toISOString(),
        }],
        assetFlows: [{
          type: 'ai_system',
          label: 'KI-Systeme',
          count: 3,
          highRisk: 1,
          href: '/app/ai-systems',
        }],
        riskDistribution: [
          { id: 'critical', label: 'Kritisch', count: 1 },
          { id: 'high', label: 'Hoch', count: 2 },
          { id: 'medium', label: 'Mittel', count: 0 },
          { id: 'low', label: 'Gering', count: 0 },
          { id: 'passed', label: 'Stabil', count: 1 },
        ],
        riskIndex: computeRiskIndex({
          assetScores: [80, 55, 55, 10],
          newRisks24h: 0,
          openIncidents: 1,
          dsrOverdue: 0,
        }),
      }),
    });
    expect(getByTestId('runtime-event-stream').textContent).toContain('Policy-Warnung Cookie-Banner');
    expect(getByTestId('asset-flows').textContent).toContain('KI-Systeme');
    expect(getByTestId('risk-distribution').textContent).toContain('Kritisch');
  });

  it('shows sync-pending banner instead of Abo aktiv when sync=pending', () => {
    const { getByTestId, queryByTestId, getByText, queryByRole } = rendered(
      { data: fixture(), livePlanId: 'starter' },
      '/app/dashboard?plan=starter&subscription=sub_test&sync=pending',
    );
    expect(getByTestId('post-checkout-sync-pending')).toBeInTheDocument();
    expect(getByText(/Zahlung eingegangen · Abo-Sync ausstehend/)).toBeInTheDocument();
    expect(queryByTestId('post-checkout-domain-cta')).toBeNull();
    expect(queryByRole('heading', { name: /Abo aktiv/ })).toBeNull();
  });

  it('shows Abo aktiv domain CTA only when sync is complete AND live plan is paid', () => {
    const { getByTestId, queryByTestId } = rendered(
      { data: fixture(), livePlanId: 'starter', entitlementsLoading: false },
      '/app/dashboard?plan=starter&subscription=sub_live',
    );
    expect(getByTestId('post-checkout-domain-cta')).toBeInTheDocument();
    expect(getByTestId('post-checkout-domain-cta').textContent).toContain('Abo aktiv');
    expect(queryByTestId('post-checkout-sync-pending')).toBeNull();
  });

  it('fail-closed: URL plan alone never claims Abo aktiv while live plan is free', () => {
    const { getByTestId, queryByTestId, queryByRole } = rendered(
      { data: fixture(), livePlanId: 'free', entitlementsLoading: false },
      '/app/dashboard?plan=starter&subscription=sub_live',
    );
    expect(getByTestId('post-checkout-sync-pending')).toBeInTheDocument();
    expect(queryByTestId('post-checkout-domain-cta')).toBeNull();
    expect(queryByRole('heading', { name: /Abo aktiv/ })).toBeNull();
  });

  it('fail-closed: entitlements still loading → sync-pending, not Abo aktiv', () => {
    const { getByTestId, queryByTestId } = rendered(
      { data: fixture(), livePlanId: null, entitlementsLoading: true },
      '/app/dashboard?plan=starter&subscription=sub_live',
    );
    expect(getByTestId('post-checkout-sync-pending')).toBeInTheDocument();
    expect(queryByTestId('post-checkout-domain-cta')).toBeNull();
  });
});
