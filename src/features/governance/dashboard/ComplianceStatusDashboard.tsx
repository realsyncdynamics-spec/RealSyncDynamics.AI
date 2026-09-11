// ComplianceStatusDashboard — kanonische /app/dashboard-Fläche.
//
// Zeigt Governance-Score, Residualrisiko, Evidence-Gesundheit, Audit-Readiness
// und offene Maßnahmen aus denselben RLS-Daten wie das CEO-Cockpit.
// Keine Mock-Fallbacks: leere Mandanten sehen leere Zustände.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Clock, ChevronRight, FileCheck2, Loader2,
  Minus, Rocket, ShieldCheck, TrendingDown, TrendingUp,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { ScoreGauge } from '../../../enterprise-os/components/ScoreGauge';
import { Button } from '../../../enterprise-os/components/Button';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import type { ScoreLevel } from '../cockpit/cockpitScore';
import { scoreLabel, scoreLevel } from '../cockpit/cockpitScore';
import { loadCockpitData, type CockpitData } from '../cockpit/cockpitData';
import { TrialBanner } from '../../workspace/TrialBanner';
import { HIGH_RISK_ASSET_THRESHOLD, type EvidenceHealth, type OpenMeasures, type RiskIndex } from './complianceStatus';

export function ComplianceStatusDashboard() {
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? null;
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    loadCockpitData(activeTenantId)
      .then((next) => { if (!cancelled) setData(next); })
      .catch((err) => { if (!cancelled) setError((err as Error)?.message ?? String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  return (
    <>
      <TrialBanner />
      <ComplianceStatusView
        tenantName={tenantName}
        activeTenantId={activeTenantId}
        data={data}
        loading={loading}
        error={error}
      />
    </>
  );
}

export interface ComplianceStatusViewProps {
  tenantName: string | null;
  activeTenantId: string | null;
  data: CockpitData | null;
  loading: boolean;
  error: string | null;
}

export function ComplianceStatusView({
  tenantName,
  activeTenantId,
  data,
  loading,
  error,
}: ComplianceStatusViewProps) {
  const navigate = useNavigate();
  const isEmptyTenant = Boolean(
    data &&
    data.partialFailures.length === 0 &&
    data.openMeasures.total === 0 &&
    data.actions.length === 0 &&
    data.evidenceHealth.percent === null &&
    data.riskIndex.score === null &&
    data.readiness === null,
  );

  return (
    <div
      data-testid="compliance-status-dashboard"
      className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">
            Compliance Operations
          </p>
          <h1 className="font-display font-bold text-2xl text-titanium-50 tracking-tight mt-1">
            {tenantName ? `Status · ${tenantName}` : 'Compliance-Status'}
          </h1>
          <p className="text-sm text-titanium-400 mt-1">
            Score, Residualrisiko, Evidence-Gesundheit und Audit-Readiness — aus Ihren Mandantendaten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTenantId && (
            <Link to="/app/cockpit/brief">
              <Button variant="secondary" size="md">
                <FileCheck2 className="h-4 w-4" /> Prüfer-Mappe
              </Button>
            </Link>
          )}
          <Link to="/app/assistant">
            <Button variant="primary" size="md">
              Governance AI
            </Button>
          </Link>
        </div>
      </div>

      {!activeTenantId && (
        <div className="py-12 text-center text-titanium-400">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-titanium-600" />
          <p className="text-sm">Bitte anmelden, um den Compliance-Status zu sehen.</p>
          <Link to="/welcome" className="mt-4 inline-flex items-center gap-2 text-security-500 text-sm font-semibold">
            Zum Login <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {data && data.partialFailures.length > 0 && (
        <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3" data-testid="compliance-partial-failure">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Teil der Governance-Daten nicht verfügbar. Das ist kein leerer Mandant.
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center gap-2 text-sm text-titanium-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Compliance-Status wird geladen …
        </div>
      )}

      {isEmptyTenant && (
        <div className="border border-titanium-800 bg-obsidian-900 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <Rocket className="h-6 w-6 text-security-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-titanium-50">Noch keine Governance-Daten</h2>
              <p className="text-sm text-titanium-300 mt-1">
                Score und Ampeln bleiben leer, solange keine Assets, Evidence oder offenen Pflichten vorliegen.
                Starten Sie mit Onboarding oder einem Website-Audit.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/onboarding')}
              className="inline-flex items-center justify-center gap-2 bg-security-500 hover:bg-security-400 text-white px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
            >
              Onboarding starten
            </button>
            <button
              type="button"
              onClick={() => navigate('/audit?source=dashboard')}
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 hover:border-titanium-500 text-titanium-200 px-4 py-2 text-sm font-semibold font-mono uppercase tracking-wider"
            >
              Website-Audit
            </button>
          </div>
        </div>
      )}

      {data && !isEmptyTenant && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-titanium-900">
            <ScoreCard
              testId="governance-score"
              eyebrow="Governance-Score"
              score={data.score}
              level={scoreLevel(data.score)}
              label={scoreLabel(data.score)}
              hint="Self-Assessment aus offenen Pflichten und KPI-Abdeckung. Keine Zertifizierung."
            />
            <RiskCard risk={data.riskIndex} />
            <EvidenceCard health={data.evidenceHealth} />
            <ReadinessCard readiness={data.readiness} trend={data.readinessTrend} />
          </div>

          {data.summary24h && (
            <section data-testid="summary-24h">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-cyan-400" />
                <h2 className="font-display font-semibold text-titanium-50 text-sm">Letzte 24 Stunden</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-titanium-900">
                <MiniStat label="Neue Risiken" value={data.summary24h.new_risks} href="/app/risks" danger={data.summary24h.new_risks > 0} />
                <MiniStat label="Neue Evidence" value={data.summary24h.new_evidence} href="/app/evidence" />
                <MiniStat label="Offene Alerts" value={data.summary24h.open_alerts} href="/app/alerts" danger={data.summary24h.critical_alerts > 0} />
                <MiniStat label="Fehler-Scans" value={data.summary24h.failed_scans} href="/app/monitoring" danger={data.summary24h.failed_scans > 0} />
              </div>
            </section>
          )}

          <OpenMeasuresCard measures={data.openMeasures} />

          <Card>
            <CardHeader
              eyebrow="Maßnahmen"
              title="Das müssen Sie als Nächstes tun"
              subtitle="Nach Schweregrad und Fristnähe. Deep-Link in die bestehende View."
            />
            <CardBody className="p-0">
              {data.actions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-titanium-400" data-testid="no-open-actions">
                  <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-risk-passed" />
                  Keine dringenden Pflichten offen.
                </div>
              ) : (
                <ul className="divide-y divide-titanium-800" data-testid="priority-actions">
                  {data.actions.map((action, index) => (
                    <li key={action.id}>
                      <Link
                        to={action.href}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-obsidian-800 transition-colors"
                      >
                        <span className="font-mono text-xs text-titanium-600 w-5 shrink-0">{index + 1}</span>
                        <StatusBadge level={action.level} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-titanium-50 truncate">{action.title}</p>
                          <p className="text-xs text-titanium-400 flex items-center gap-1.5 mt-0.5">
                            <Clock className="h-3 w-3" /> {action.detail}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-titanium-600 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {data.posture && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-titanium-900">
              <CoverageCard label="Richtlinien aktiv" percent={data.posture.policiesEnabledPercent} />
              <CoverageCard label="Evidence-Abdeckung" percent={data.posture.assetEvidencePercent} />
              <CoverageCard label="Kontroll-Mapping" percent={data.posture.assetMappingsPercent} />
            </div>
          )}

          <p className="text-[11px] text-titanium-600 font-mono">
            {data.lastUpdated
              ? `KPI-Stand: ${data.lastUpdated}`
              : 'KPI-Snapshot noch nicht verfügbar — Score aus Echtzeit-Zählern.'}
            {' · '}
            <Link to="/app/home" className="hover:text-titanium-300 underline">Workspace</Link>
            {' · '}
            <Link to="/app/overview" className="hover:text-titanium-300 underline">Module</Link>
          </p>
        </>
      )}
    </div>
  );
}

function ScoreCard({
  testId,
  eyebrow,
  score,
  level,
  label,
  hint,
}: {
  testId: string;
  eyebrow: string;
  score: number;
  level: ScoreLevel;
  label: string;
  hint: string;
}) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6" data-testid={testId}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">{eyebrow}</p>
      <ScoreGauge score={score} size={112} tone="health" />
      <StatusBadge level={level} label={label} />
      <p className="px-4 text-center text-[11px] text-titanium-500">{hint}</p>
    </Card>
  );
}

function RiskCard({ risk }: { risk: RiskIndex }) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6" data-testid="risk-index">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Residualrisiko</p>
      {risk.score === null ? (
        <EmptyMetric value="–" caption={risk.label} />
      ) : (
        <>
          <ScoreGauge score={risk.score} size={112} tone="risk" label="Risiko-Index" />
          <LevelBadge level={risk.level} label={risk.label} />
        </>
      )}
      <p className="px-4 text-center text-[11px] text-titanium-500 font-mono">
        {risk.assetCount} Assets · {risk.highRiskAssets} ≥ {HIGH_RISK_ASSET_THRESHOLD}
        {risk.newRisks24h > 0 ? ` · +${risk.newRisks24h} / 24h` : ''}
      </p>
    </Card>
  );
}

function EvidenceCard({ health }: { health: EvidenceHealth }) {
  return (
    <Card className="bg-obsidian-900 flex flex-col items-center justify-center gap-3 py-6" data-testid="evidence-health">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Evidence-Gesundheit</p>
      {health.percent === null ? (
        <EmptyMetric value="–" caption={health.label} />
      ) : (
        <>
          <ScoreGauge score={health.percent} size={112} tone="health" label="Health" />
          <LevelBadge level={health.level} label={health.label} />
        </>
      )}
      <p className="px-4 text-center text-[11px] text-titanium-500 font-mono">
        {health.hashedCount}/{health.totalCount} gehasht
        {health.failedScans > 0 ? ` · ${health.failedScans} Scan-Fehler` : ''}
      </p>
    </Card>
  );
}

function ReadinessCard({
  readiness,
  trend,
}: {
  readiness: number | null;
  trend: CockpitData['readinessTrend'];
}) {
  return (
    <Card className="bg-obsidian-900" data-testid="audit-readiness">
      <CardBody className="flex flex-col justify-center h-full gap-3 py-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500">Audit-Readiness</p>
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-5xl font-bold text-titanium-50">
            {readiness === null ? '–' : `${readiness}%`}
          </span>
          {trend && <TrendChip {...trend} />}
        </div>
        <p className="text-xs text-titanium-400">
          Anteil der Objekte mit Kontroll-Mapping. Indikativ, keine Bescheinigung.
        </p>
      </CardBody>
    </Card>
  );
}

function OpenMeasuresCard({ measures }: { measures: OpenMeasures }) {
  return (
    <Card data-testid="open-measures">
      <CardHeader
        eyebrow="Offene Maßnahmen"
        title={`${measures.total} offene Posten`}
        subtitle="Zähler aus Incidents, DSFA, DSR, Freigaben und Vendoren ohne AVV."
      />
      <CardBody className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-titanium-800">
          <MeasureLink href="/app/incidents" label="Vorfälle" value={measures.incidents} danger={measures.incidents > 0} />
          <MeasureLink href="/app/dsr" label="DSR überfällig" value={measures.dsrOverdue} danger={measures.dsrOverdue > 0} />
          <MeasureLink href="/app/dpia" label="Offene DSFA" value={measures.dpias} />
          <MeasureLink href="/app/approvals" label="Freigaben" value={measures.approvals} />
          <MeasureLink href="/app/vendors" label="Ohne AVV" value={measures.vendorsNoDpa} danger={measures.vendorsNoDpa > 0} />
          <MeasureLink href="/app/dsr" label="DSR offen" value={measures.dsrOpen} />
        </div>
      </CardBody>
    </Card>
  );
}

function MeasureLink({
  href, label, value, danger = false,
}: {
  href: string;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <Link to={href} className="px-4 py-4 hover:bg-obsidian-800 transition-colors block">
      <p className={`font-mono text-2xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </Link>
  );
}

function MiniStat({
  label, value, href, danger = false,
}: {
  label: string;
  value: number;
  href: string;
  danger?: boolean;
}) {
  return (
    <Link to={href} className="bg-obsidian-900 px-4 py-3 hover:bg-obsidian-800 transition-colors block">
      <p className={`font-mono text-xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </Link>
  );
}

function CoverageCard({ label, percent }: { label: string; percent: number }) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <div className="bg-obsidian-900 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono">{label}</p>
        <span className="font-mono text-sm font-bold text-titanium-50">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 bg-titanium-900 w-full">
        <div className="h-full bg-security-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TrendChip({ direction, percent }: { direction: 'up' | 'down' | 'flat'; percent: number }) {
  if (direction === 'flat' || percent === 0) {
    return <span className="inline-flex items-center gap-1 text-xs text-titanium-500"><Minus className="h-3 w-3" /> stabil</span>;
  }
  const up = direction === 'up';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono ${up ? 'text-risk-passed' : 'text-risk-high'}`}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {percent}%
    </span>
  );
}

function EmptyMetric({ value, caption }: { value: string; caption: string }) {
  return (
    <div className="text-center">
      <p className="font-mono text-5xl font-bold text-titanium-600">{value}</p>
      <p className="mt-2 text-xs text-titanium-400">{caption}</p>
    </div>
  );
}

function LevelBadge({ level, label }: { level: ScoreLevel | 'unknown'; label: string }) {
  if (level === 'unknown') {
    return (
      <span className="inline-flex items-center gap-1.5 border border-titanium-700 bg-titanium-900/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-titanium-400">
        {label}
      </span>
    );
  }
  return <StatusBadge level={level} label={label} />;
}
