import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ComplianceStatusView } from '../../../../src/features/governance/dashboard/ComplianceStatusDashboard';
import type { CockpitData } from '../../../../src/features/governance/cockpit/cockpitData';
import {
  computeEvidenceHealth,
  computeOpenMeasures,
  computeRiskIndex,
  EMPTY_SUMMARY_24H,
} from '../../../../src/features/governance/dashboard/complianceStatus';
import { computeAuditReadiness, computeGovernanceScore, type CockpitCounts } from '../../../../src/features/governance/cockpit/cockpitScore';
import type { BootstrapStep } from '../../../../src/features/governance/dashboard/workspaceBootstrapSteps';

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
  };
}

const BOOTSTRAP: BootstrapStep[] = [
  {
    id: 'add-domain',
    title: 'Domain hinterlegen',
    detail: 'Ohne Domain bleiben Score und Zähler leer.',
    href: '/app/websites',
    level: 'high',
  },
  {
    id: 'start-audit',
    title: 'Audit starten',
    detail: 'Öffentlicher Website-Scan.',
    href: '/audit?source=dashboard',
    level: 'high',
  },
  {
    id: 'activation',
    title: 'Activation starten',
    detail: 'Organisation und Scope festlegen.',
    href: '/app/activation',
    level: 'medium',
  },
];

function rendered(props: Partial<Parameters<typeof ComplianceStatusView>[0]> = {}) {
  return render(
    <MemoryRouter>
      <ComplianceStatusView
        tenantName="Acme GmbH"
        activeTenantId="tenant-1"
        data={null}
        loading={false}
        error={null}
        bootstrapSteps={[]}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe('ComplianceStatusView — empty but actionable', () => {
  it('shows Domain hinterlegen / Audit / Activation on empty tenant', () => {
    const { getByTestId, getByText, queryByTestId } = rendered({
      data: fixture(),
      bootstrapSteps: BOOTSTRAP,
    });
    expect(getByText('Noch keine Governance-Daten')).toBeInTheDocument();
    expect(getByTestId('cta-domain-hinterlegen')).toBeInTheDocument();
    expect(getByTestId('cta-audit-starten')).toBeInTheDocument();
    expect(getByTestId('cta-activation')).toBeInTheDocument();
    expect(queryByTestId('governance-score')).toBeNull();
    expect(getByTestId('bootstrap-next-steps').textContent).toContain('Domain hinterlegen');
    expect(getByTestId('framework-strip')).toBeInTheDocument();
    expect(getByTestId('framework-dsgvo')).toHaveAttribute(
      'href',
      '/app/governance/dsgvo-directory',
    );
    expect(getByTestId('framework-tisax-roadmap')).toBeInTheDocument();
  });

  it('replaces „Keine dringenden Pflichten“ with bootstrap CTAs when counters are zero', () => {
    const { getByTestId, queryByTestId } = rendered({
      data: fixture({
        counts: { ...ZERO, incidents: 1 },
        summary24h: { ...EMPTY_SUMMARY_24H },
        actions: [],
      }),
      bootstrapSteps: BOOTSTRAP,
    });
    expect(queryByTestId('no-open-actions')).toBeNull();
    expect(getByTestId('bootstrap-step-add-domain')).toHaveAttribute('href', '/app/websites');
    expect(getByTestId('bootstrap-step-start-audit')).toHaveAttribute(
      'href',
      '/audit?source=dashboard',
    );
    expect(getByTestId('bootstrap-step-activation')).toHaveAttribute('href', '/app/activation');
  });
});
