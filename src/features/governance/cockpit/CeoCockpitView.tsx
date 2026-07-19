// CeoCockpitView — Executive-Einstieg unter /app.
//
// Verdichtet vorhandene, RLS-gescopte Daten (Count-Helfer + KPI-Snapshot +
// Detail-Listen) zu der einen Antwort, die eine Geschäftsführung in 30
// Sekunden braucht: Gesamt-Score, Audit-Readiness, Top-3-Pflichten, Fristen.
// Nutzt ausschliesslich bestehende APIs — kein neues Backend.
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, FileCheck2, Loader2, ShieldCheck,
  TrendingDown, TrendingUp, Minus, Clock, ChevronRight, Rocket, CheckCircle,
} from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { ScoreGauge } from '../../../enterprise-os/components/ScoreGauge';
import { Button } from '../../../enterprise-os/components/Button';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import { scoreLabel, scoreLevel } from './cockpitScore';
import { loadCockpitData, type CockpitData } from './cockpitData';
import { GovernanceBriefCard } from './GovernanceBriefCard';
import { ApiStatusCard } from '../../../features/api/ApiStatusCard';
import { usePerformanceMonitor, measureAsync } from '../../../lib/performance';

function _CeoCockpitView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const CeoCockpitView = withPerformanceMonitoring(
  _CeoCockpitView,
  'CeoCockpitView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { activeTenantId } = useTenant();
  const navigate = useNavigate();
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadData();
  }, [activeTenantId]);

  const loadData = async () => {
    if (!activeTenantId) return;
    try {
      setLoading(true);
      const result = await measureAsync(
        'cockpit-api',
        () => loadCockpitData(activeTenantId)
      );
      setData(result);
    } catch (err) {
      console.error('Failed to load cockpit data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin mx-auto mb-3" />
          <p className="text-[12px] text-titanium-400">Governance Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  const scoreLvl = scoreLevel(data.score);
  const scoreMsg = scoreLabel(data.score);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-titanium-50">Governance Cockpit</h1>
        <p className="text-sm text-titanium-400 mt-1">Ihre Governance-Position auf einen Blick</p>
      </div>

      {/* Main Score Card */}
      <Card className="border-security-500/30">
        <CardHeader
          title="Gesamtbewertung"
          subtitle="DSGVO + EU AI Act Compliance"
          action={<StatusBadge level={scoreLvl} label={scoreMsg} />}
        />
        <CardBody>
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0">
              <ScoreGauge score={data.score} size={128} />
            </div>
            <div className="flex-1 space-y-4">
              <Metric label="Open Items" value={data.counts.incidents + data.counts.dpias + data.counts.approvals} />
              {data.readinessTrend && <TrendChip direction={data.readinessTrend.direction} percent={data.readinessTrend.percent} />}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-security-500">{data.readiness ?? '-'}%</p>
            <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-2">Audit-Readiness</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className={`text-3xl font-bold ${data.counts.incidents > 0 ? 'text-risk-high' : 'text-security-500'}`}>
              {data.counts.incidents}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-2">Offene Incidents</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <p className="text-3xl font-bold text-titanium-50">{data.counts.dpias}</p>
            <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-2">DPIAs</p>
          </CardBody>
        </Card>
      </div>

      {/* Coverage Breakdown */}
      {data.posture && (
        <Card>
          <CardHeader title="Framework-Abdeckung" />
          <CardBody className="space-y-3">
            <CoverageCard label="Policies Enabled" percent={data.posture.policiesEnabledPercent} />
            <CoverageCard label="Asset Evidence" percent={data.posture.assetEvidencePercent} />
            <CoverageCard label="Asset Mappings" percent={data.posture.assetMappingsPercent} />
          </CardBody>
        </Card>
      )}

      {/* Top Actions & Deadlines */}
      {data.actions.length > 0 && (
        <Card>
          <CardHeader title="Top Actions" />
          <CardBody className="space-y-2">
            {data.actions.slice(0, 3).map((action) => (
              <RouterLink
                key={action.id}
                to={action.href}
                className="p-2 bg-obsidian-900 hover:bg-obsidian-800 rounded-sm text-[12px] block transition-colors"
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-titanium-300">{action.title}</p>
                  <StatusBadge level={action.level} />
                </div>
                <p className="text-[10px] text-titanium-500 mt-0.5">{action.detail}</p>
              </RouterLink>
            ))}
          </CardBody>
        </Card>
      )}

      {/* Governance Brief */}
      <GovernanceBriefCard />

      {/* API Status */}
      <Card>
        <CardHeader title="System Status" />
        <CardBody>
          <ApiStatusCard />
        </CardBody>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => navigate('/app/incidents')}
          className="flex items-center gap-2"
        >
          <ShieldCheck className="h-4 w-4" />
          Incidents
        </Button>
        <Button
          onClick={() => navigate('/app/dpia')}
          className="flex items-center gap-2"
        >
          <FileCheck2 className="h-4 w-4" />
          DPIAs
        </Button>
        <Button
          onClick={() => navigate('/app/settings')}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Settings
        </Button>
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

function Metric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={`font-mono text-2xl font-bold ${danger ? 'text-rose-300' : 'text-titanium-50'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-titanium-500 font-mono mt-0.5">{label}</p>
    </div>
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
        <div
          className="h-full bg-security-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
